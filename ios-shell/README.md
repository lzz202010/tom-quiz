# beta111 iOS 套壳工程

这是一套可在 Xcode 里打开、由你自己签名出包的工程，不是已经签好的 `.ipa`。壳里是一个全屏 WebView，打开线上站点：

https://lzz202010.github.io/tom-quiz/ultimate/

网站更新后，一般不用重新打包；只有改壳本身（图标、包名、离线内置资源）才需要重新出包。

## 你需要什么

- 一台装了 Xcode 的 Mac
- 你自己的 Apple ID 或付费开发者账号（用来签名）
- 真机或用于导出 `ipa` 的证书 / 描述文件

## 怎么出包

1. 用 Xcode 打开 `beta111.xcodeproj`
2. 选中左侧 `beta111` 靶 → Signing & Capabilities
3. 勾选 Automatically manage signing，在 Team 里选你的账号
4. 如包名冲突，把 Bundle Identifier（默认 `com.lzz202010.beta111`）改成你自己的
5. 连上 iPhone，选你的设备，点 Run，即可装到手机上调试
6. 要导出安装包：菜单 Product → Archive，完成后 Distribute App，选 Development 或 Ad Hoc，按提示导出 `.ipa`

个人免费 Apple ID 通常只能把 App 装到你自己的设备上，有效期约 7 天；付费开发者账号才能做较稳定的 Ad Hoc / 内测分发。

## 说明

- 最低系统：iOS 15
- 图标用了站点现有的 Apple 触摸图标；启动底色跟站点浅色背景一致
- 本工程不含签名文件、证书或已编译的 `.ipa`
