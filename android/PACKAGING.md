# LuckyTodo 打包 APK / AAB 教程

本仓库已包含 **Capacitor Android** 工程（`android/`）。在装有 **Android Studio** 的电脑上即可打出可安装包。

相关说明：iOS 见 [`../ios/PACKAGING.md`](../ios/PACKAGING.md)。

## 0. 前提

| 项 | 说明 |
|----|------|
| 电脑 | Windows / macOS / Linux + Android Studio（推荐最新稳定版） |
| JDK | Android Studio 自带即可；命令行构建需 JDK 17+ |
| 包名 | `family.luckytodo.app`（与 iOS Bundle ID 一致） |
| 版本 | `android/app/build.gradle` 中 `versionName` / `versionCode` |

> 云端轻量环境通常没有完整 Android SDK；请在本机 Android Studio 中 Archive / Build。

## 1. 同步前端到 Android 工程

在仓库根目录：

```bash
git checkout main
git pull
npm install
npx cap sync android
npx cap open android
```

- `cap sync` 会把 `apps/web` 拷进 Android，并更新原生插件。
- **以后改了前端，每次打包装前都要再 sync 一次。**
- `cap open android` 会用 Android Studio 打开 `android/` 工程。

也可：

```bash
npm run cap:sync
npm run cap:android
```

## 2. Android Studio 首次配置

1. 打开工程后等待 **Gradle Sync** 完成。
2. 若提示安装 SDK / Build-Tools / 平台 API 34，按提示安装。
3. 顶部设备可选：
   - 已连接的真机（建议开启开发者选项与 USB 调试）
   - 或任意模拟器

图标与启动图已按 LuckyTodo Logo 生成。若要重做资源：

```bash
# 需要本机 Python3 + Pillow：pip install pillow
npm run android:assets
npx cap sync android
```

## 3. 真机跑通（强烈建议先做）

1. 连接 Android 手机，允许 USB 调试。
2. Android Studio 点 **Run**（绿色三角），安装 Debug 包。
3. 检查：
   - App 能打开并完成本机注册 / 登录
   - 新建待办、计划；本地通知权限允许后提醒可用
   - 「我的」里连接家庭服务器（HTTPS）后能同步
   - 系统返回键：二级页返回上一层，首页退出应用
   - 长按桌面 → 添加「今日提醒 / 家庭日历」组件；App 内刷新快照后组件有数据；日历「+」可快速添加待办草稿

## 4. 打 Debug APK（家人试用最快）

Android Studio：

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. 完成后点 **locate**，得到：

   `android/app/build/outputs/apk/debug/app-debug.apk`

命令行（需已配置 SDK，`ANDROID_HOME` 有效）：

```bash
npx cap sync android
cd android && ./gradlew assembleDebug
```

把 `app-debug.apk` 拷到手机安装即可。首次安装需在系统设置里允许「未知来源」或「安装未知应用」。

## 5. 打正式签名 APK / AAB

### 5.1 生成密钥库（只做一次，务必备份）

```bash
keytool -genkeypair -v \
  -keystore luckytodo-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias luckytodo
```

把 `.jks` 放到安全位置（**不要提交到 Git**）。

### 5.2 配置签名

在 `android/keystore.properties`（已加入忽略规则，勿提交）写入：

```properties
storeFile=/绝对路径/luckytodo-release.jks
storePassword=你的密码
keyAlias=luckytodo
keyPassword=你的密码
```

工程里的 `android/app/build.gradle` 已接好可选签名：只要存在 `keystore.properties`，`assembleRelease` / `bundleRelease` 就会用正式证书签名。

### 5.3 导出

```bash
npx cap sync android
cd android && ./gradlew assembleRelease   # APK
# 或
cd android && ./gradlew bundleRelease    # AAB（Google Play）
```

产物位置：

- APK：`android/app/build/outputs/apk/release/app-release.apk`
- AAB：`android/app/build/outputs/bundle/release/app-release.aab`

## 6. 版本号

改 `android/app/build.gradle`：

```gradle
versionCode 4        // 每次上架 / 分发递增整数
versionName "0.3.1"  // 用户可见版本
```

与根目录 `package.json` 的 `version` 尽量保持一致。

## 7. 与 iOS / 服务端的关系

| 能力 | Android |
|------|---------|
| 本机账号、待办 / 日程 / 计划 | 与 Web / iOS 相同 |
| 家庭 NAS 同步 | 相同；地址必须 HTTPS |
| 本地通知 | Capacitor Local Notifications（需用户授权） |
| 主屏组件 | **今日提醒 / 家庭日历**（见 [`WIDGETS.md`](./WIDGETS.md)） |
| Google Play 上架 | 可用 AAB；需另备商店材料与隐私政策 |

服务端仍用飞牛 Docker：`deploy/docker-compose.yml`。

## 8. 常见问题

| 现象 | 处理 |
|------|------|
| Gradle Sync 失败 | 按 Android Studio 提示安装 SDK 34 / Build-Tools；检查网络代理 |
| `cap open` 找不到 Studio | 手动打开 `android/` 目录 |
| 前端改了 App 仍是旧的 | 再执行 `npx cap sync android` |
| 通知不弹 | 系统设置里打开通知权限；Android 13+ 首次会请求 |
| 无法连 NAS | 确认域名 HTTPS、证书有效；应用拒绝明文 HTTP |
| 安装被拦截 | 允许对应文件管理器 / 浏览器的「安装未知应用」 |

## 9. 最短路径（备忘）

```text
npm install
→ npx cap sync android
→ Android Studio 打开 android/
→ 真机 Run 验证
→ Build APK（debug）给家人装
→ 需要正式包时再配 keystore → assembleRelease / bundleRelease
```
