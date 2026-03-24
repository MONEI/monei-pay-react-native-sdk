Pod::Spec.new do |s|
  s.name           = 'MoneiPayReactNative'
  s.version        = '0.1.0'
  s.summary        = 'React Native SDK for MONEI Pay NFC payments'
  s.description    = 'Accept NFC tap-to-pay payments in your React Native app via MONEI Pay'
  s.homepage       = 'https://github.com/MONEI/monei-pay-react-native-sdk'
  s.license        = { :type => 'MIT' }
  s.author         = 'MONEI'
  s.source         = { :git => 'https://github.com/MONEI/monei-pay-react-native-sdk.git', :tag => s.version.to_s }
  s.platforms      = { :ios => '15.0' }
  s.source_files   = '**/*.swift'
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
end
