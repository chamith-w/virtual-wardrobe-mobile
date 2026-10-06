import CoreImage
import ExpoModulesCore
import UIKit
import Vision

/// Options for `removeBackgroundAsync`.
struct SegmentOptions: Record {
  /// Longest side, in pixels, of the photo handed to Vision. Bigger photos are scaled down first.
  @Field var maxSide: Double = 2048
  /// Transparent margin kept around the subject, as a fraction of its longer side.
  @Field var padding: Double = 0.04
}

final class SegmentationUnsupportedException: Exception {
  override var reason: String {
    "On-device background removal needs iOS 17 on a real device (the Simulator can't run it)"
  }
}

final class ImageUnreadableException: GenericException<String> {
  override var reason: String {
    "Could not read the image at \(param)"
  }
}

final class NoSubjectException: Exception {
  override var reason: String {
    "No subject was found in the photo"
  }
}

final class CutoutWriteException: Exception {
  override var reason: String {
    "Could not write the cutout image"
  }
}

/// Lifts the subject of a photo onto a transparent PNG with Vision's
/// foreground instance mask (iOS 17+), cropped to the subject.
public class SubjectSegmentationModule: Module {
  private lazy var ciContext = CIContext(options: [.useSoftwareRenderer: false])

  public func definition() -> ModuleDefinition {
    Name("SubjectSegmentation")

    // Android reports model download progress; declared here so both platforms share one API.
    Events("onPrepareProgress")

    // Vision ships with the OS: there's nothing to download, so it's ready or it isn't.
    AsyncFunction("getStatusAsync") { () -> String in
      return Self.isSupported ? "ready" : "unsupported"
    }

    AsyncFunction("prepareAsync") { () -> String in
      guard Self.isSupported else {
        throw SegmentationUnsupportedException()
      }
      return "ready"
    }

    AsyncFunction("removeBackgroundAsync") { (url: URL, options: SegmentOptions) -> [String: Any] in
      guard Self.isSupported else {
        throw SegmentationUnsupportedException()
      }
      return try self.removeBackground(url: url, options: options)
    }
  }

  static var isSupported: Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    return true
    #endif
  }

  private func removeBackground(url: URL, options: SegmentOptions) throws -> [String: Any] {
    guard let photo = UIImage(contentsOfFile: url.path),
          let source = Self.upright(photo, maxSide: CGFloat(options.maxSide)) else {
      throw ImageUnreadableException(url.path)
    }

    let handler = VNImageRequestHandler(cgImage: source, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    try handler.perform([request])
    guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
      throw NoSubjectException()
    }

    // Full-size subject on transparency; we crop ourselves so we know where it sat.
    let masked = try observation.generateMaskedImage(
      ofInstances: observation.allInstances,
      from: handler,
      croppedToInstancesExtent: false
    )
    let maskedImage = CIImage(cvPixelBuffer: masked)
    guard let cutout = ciContext.createCGImage(maskedImage, from: maskedImage.extent),
          let subject = Self.opaqueBounds(of: cutout) else {
      throw NoSubjectException()
    }

    let pad = max(subject.width, subject.height) * CGFloat(options.padding)
    let imageRect = CGRect(x: 0, y: 0, width: cutout.width, height: cutout.height)
    let crop = subject.insetBy(dx: -pad, dy: -pad).intersection(imageRect).integral
    guard let cropped = cutout.cropping(to: crop),
          let data = UIImage(cgImage: cropped).pngData() else {
      throw CutoutWriteException()
    }

    let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("SubjectSegmentation", isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let file = folder.appendingPathComponent("\(UUID().uuidString).png")
    do {
      try data.write(to: file)
    } catch {
      throw CutoutWriteException()
    }

    return [
      "uri": file.absoluteString,
      "width": cropped.width,
      "height": cropped.height,
      "sourceWidth": source.width,
      "sourceHeight": source.height,
      "bounds": [
        "x": crop.origin.x,
        "y": crop.origin.y,
        "width": crop.width,
        "height": crop.height,
      ],
    ]
  }

  /// The photo drawn upright (EXIF orientation applied) and scaled so its longer side is at most `maxSide`.
  private static func upright(_ image: UIImage, maxSide: CGFloat) -> CGImage? {
    let pixelWidth = image.size.width * image.scale
    let pixelHeight = image.size.height * image.scale
    let scale = min(1, maxSide / max(pixelWidth, pixelHeight))
    let size = CGSize(width: floor(pixelWidth * scale), height: floor(pixelHeight * scale))
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }.cgImage
  }

  /// Bounding box of the visible pixels, found on a small copy (fast even in debug builds) and scaled back up.
  private static func opaqueBounds(of image: CGImage, probeSide: Int = 512) -> CGRect? {
    let scale = min(1, CGFloat(probeSide) / CGFloat(max(image.width, image.height)))
    let width = max(1, Int(CGFloat(image.width) * scale))
    let height = max(1, Int(CGFloat(image.height) * scale))
    var pixels = [UInt8](repeating: 0, count: width * height * 4)

    let drawn: Bool = pixels.withUnsafeMutableBytes { buffer in
      guard let context = CGContext(
        data: buffer.baseAddress,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      ) else {
        return false
      }
      context.interpolationQuality = .low
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard drawn else { return nil }

    var minX = width, minY = height, maxX = -1, maxY = -1
    for y in 0..<height {
      let row = y * width * 4
      for x in 0..<width where pixels[row + x * 4 + 3] > 12 {
        if x < minX { minX = x }
        if x > maxX { maxX = x }
        if y < minY { minY = y }
        if y > maxY { maxY = y }
      }
    }
    guard maxX >= minX, maxY >= minY else { return nil }

    // Back to full size, one probe pixel wider on each side to cover rounding.
    let inverse = 1 / scale
    return CGRect(
      x: CGFloat(minX - 1) * inverse,
      y: CGFloat(minY - 1) * inverse,
      width: CGFloat(maxX - minX + 3) * inverse,
      height: CGFloat(maxY - minY + 3) * inverse
    )
  }
}
