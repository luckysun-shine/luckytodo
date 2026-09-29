import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "WidgetBridgePlugin"
  public let jsName = "WidgetBridge"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "writeSnapshot", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "consumeDrafts", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "reloadTimelines", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "hasAppGroup", returnType: CAPPluginReturnPromise)
  ]

  @objc func hasAppGroup(_ call: CAPPluginCall) {
    call.resolve(["ok": WidgetStore.containerURL != nil, "group": WidgetConstants.appGroupId])
  }

  @objc func writeSnapshot(_ call: CAPPluginCall) {
    guard let value = call.getObject("snapshot") else {
      call.reject("missing snapshot")
      return
    }
    do {
      let data = try JSONSerialization.data(withJSONObject: value, options: [])
      let snap = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
      try WidgetStore.saveSnapshot(snap)
      WidgetStore.reloadAllTimelines()
      call.resolve(["ok": true])
    } catch {
      call.reject("write failed: \(error.localizedDescription)")
    }
  }

  @objc func consumeDrafts(_ call: CAPPluginCall) {
    let drafts = WidgetStore.loadDrafts()
    do {
      try WidgetStore.clearDrafts()
      let data = try JSONEncoder().encode(drafts)
      let obj = try JSONSerialization.jsonObject(with: data)
      call.resolve(["drafts": obj])
    } catch {
      call.reject("consume failed: \(error.localizedDescription)")
    }
  }

  @objc func reloadTimelines(_ call: CAPPluginCall) {
    WidgetStore.reloadAllTimelines()
    call.resolve(["ok": true])
  }
}
