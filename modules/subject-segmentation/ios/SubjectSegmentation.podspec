Pod::Spec.new do |s|
  s.name           = 'SubjectSegmentation'
  s.version        = '1.0.0'
  s.summary        = 'On-device garment cutouts with the Vision foreground instance mask'
  s.description    = 'Local Expo module for My Closet: lifts the subject of a photo onto a transparent PNG.'
  s.license        = 'MIT'
  s.author         = 'My Closet'
  s.homepage       = 'https://github.com/chamith-w/my-closet'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
