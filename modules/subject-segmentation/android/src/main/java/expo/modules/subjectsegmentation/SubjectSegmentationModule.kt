package expo.modules.subjectsegmentation

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.Rect
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.common.moduleinstall.InstallStatusListener
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate.InstallState
import com.google.android.gms.tasks.Task
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Options for `removeBackgroundAsync`. */
class SegmentOptions : Record {
  /** Longest side, in pixels, of the photo handed to ML Kit. Bigger photos are scaled down first. */
  @Field
  val maxSide: Int = 2048

  /** Transparent margin kept around the subject, as a fraction of its longer side. */
  @Field
  val padding: Double = 0.04
}

internal class ImageUnreadableException(uri: String) :
  CodedException("Could not read the image at $uri")

internal class NoSubjectException :
  CodedException("No subject was found in the photo")

internal class ModelUnavailableException(cause: Throwable?) :
  CodedException("The on-device cutout model could not be downloaded", cause)

internal class CutoutWriteException(cause: Throwable?) :
  CodedException("Could not write the cutout image", cause)

/**
 * Lifts the subject of a photo onto a transparent PNG with ML Kit Subject
 * Segmentation, cropped to the subject. The model is unbundled: Google Play
 * services downloads it on first use, which `prepareAsync` drives and reports.
 */
class SubjectSegmentationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val segmenterDelegate = lazy {
    SubjectSegmentation.getClient(SubjectSegmenterOptions.Builder().enableForegroundBitmap().build())
  }
  private val segmenter: SubjectSegmenter by segmenterDelegate

  override fun definition() = ModuleDefinition {
    Name("SubjectSegmentation")

    Events("onPrepareProgress")

    AsyncFunction("getStatusAsync") Coroutine { ->
      val available = ModuleInstall.getClient(context).areModulesAvailable(segmenter).await().areModulesAvailable()
      if (available) "ready" else "needs-download"
    }

    AsyncFunction("prepareAsync") Coroutine { ->
      prepare()
      "ready"
    }

    AsyncFunction("removeBackgroundAsync") Coroutine { uri: String, options: SegmentOptions ->
      prepare()
      withContext(Dispatchers.Default) { removeBackground(uri, options) }
    }

    OnDestroy {
      if (segmenterDelegate.isInitialized()) segmenter.close()
    }
  }

  /** Makes sure the model is on the device, downloading it (with progress events) if not. */
  private suspend fun prepare() {
    val client = ModuleInstall.getClient(context)
    if (client.areModulesAvailable(segmenter).await().areModulesAvailable()) return

    val done = CompletableDeferred<Unit>()
    val listener = object : InstallStatusListener {
      override fun onInstallStatusUpdated(update: ModuleInstallStatusUpdate) {
        update.progressInfo?.let { info ->
          if (info.totalBytesToDownload > 0) {
            val progress = info.bytesDownloaded.toDouble() / info.totalBytesToDownload
            sendEvent("onPrepareProgress", mapOf("progress" to progress))
          }
        }
        when (update.installState) {
          InstallState.STATE_COMPLETED -> done.complete(Unit)
          InstallState.STATE_FAILED, InstallState.STATE_CANCELED ->
            done.completeExceptionally(ModelUnavailableException(null))
          else -> Unit
        }
      }
    }
    val request = ModuleInstallRequest.newBuilder().addApi(segmenter).setListener(listener).build()
    try {
      val response = client.installModules(request).await()
      if (!response.areModulesAlreadyInstalled()) done.await()
    } catch (e: CodedException) {
      throw e
    } catch (e: Exception) {
      throw ModelUnavailableException(e)
    } finally {
      client.unregisterListener(listener)
    }
  }

  private suspend fun removeBackground(uri: String, options: SegmentOptions): Map<String, Any> {
    val source = loadUpright(Uri.parse(uri), options.maxSide) ?: throw ImageUnreadableException(uri)
    val result = segmenter.process(InputImage.fromBitmap(source, 0)).await()
    val foreground = result.foregroundBitmap ?: throw NoSubjectException()
    val subject = opaqueBounds(foreground) ?: throw NoSubjectException()

    val pad = (max(subject.width(), subject.height()) * options.padding).roundToInt()
    val crop = Rect(subject.left - pad, subject.top - pad, subject.right + pad, subject.bottom + pad)
    crop.intersect(0, 0, foreground.width, foreground.height)
    val cropped = Bitmap.createBitmap(foreground, crop.left, crop.top, crop.width(), crop.height())

    val folder = File(context.cacheDir, "SubjectSegmentation").apply { mkdirs() }
    val file = File(folder, "${UUID.randomUUID()}.png")
    try {
      FileOutputStream(file).use { cropped.compress(Bitmap.CompressFormat.PNG, 100, it) }
    } catch (e: Exception) {
      throw CutoutWriteException(e)
    }

    return mapOf(
      "uri" to Uri.fromFile(file).toString(),
      "width" to cropped.width,
      "height" to cropped.height,
      "sourceWidth" to source.width,
      "sourceHeight" to source.height,
      "bounds" to mapOf(
        "x" to crop.left,
        "y" to crop.top,
        "width" to crop.width(),
        "height" to crop.height(),
      ),
    )
  }

  /** Decodes the photo upright (EXIF orientation applied), its longer side at most `maxSide`. */
  private fun loadUpright(uri: Uri, maxSide: Int): Bitmap? {
    val resolver = context.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) } ?: return null
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
    val decodeOptions = BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    val decoded = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, decodeOptions) }
      ?: return null
    val orientation = resolver.openInputStream(uri)?.use {
      ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    } ?: ExifInterface.ORIENTATION_NORMAL

    val scale = min(1f, maxSide.toFloat() / max(decoded.width, decoded.height))
    val matrix = Matrix().apply {
      postScale(scale, scale)
      when (orientation) {
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> postScale(-1f, 1f)
        ExifInterface.ORIENTATION_ROTATE_180 -> postRotate(180f)
        ExifInterface.ORIENTATION_FLIP_VERTICAL -> postScale(1f, -1f)
        ExifInterface.ORIENTATION_TRANSPOSE -> {
          postRotate(90f)
          postScale(-1f, 1f)
        }
        ExifInterface.ORIENTATION_ROTATE_90 -> postRotate(90f)
        ExifInterface.ORIENTATION_TRANSVERSE -> {
          postRotate(-90f)
          postScale(-1f, 1f)
        }
        ExifInterface.ORIENTATION_ROTATE_270 -> postRotate(-90f)
      }
    }
    val upright = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    if (upright !== decoded) decoded.recycle()
    return upright
  }

  /** Bounding box of the visible pixels, or null if the bitmap is fully transparent. */
  private fun opaqueBounds(bitmap: Bitmap): Rect? {
    val width = bitmap.width
    val height = bitmap.height
    val row = IntArray(width)
    var minX = width
    var minY = height
    var maxX = -1
    var maxY = -1
    for (y in 0 until height) {
      bitmap.getPixels(row, 0, width, 0, y, width, 1)
      for (x in 0 until width) {
        if ((row[x] ushr 24) > 12) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    return if (maxX < minX || maxY < minY) null else Rect(minX, minY, maxX + 1, maxY + 1)
  }
}

private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { continuation ->
  addOnSuccessListener { continuation.resume(it) }
  addOnFailureListener { continuation.resumeWithException(it) }
  addOnCanceledListener { continuation.cancel() }
}
