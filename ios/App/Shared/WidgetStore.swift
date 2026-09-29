import Foundation
import WidgetKit

public enum WidgetStore {
  public static var containerURL: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: WidgetConstants.appGroupId)
  }

  public static func loadSnapshot() -> WidgetSnapshot {
    guard let url = containerURL?.appendingPathComponent(WidgetConstants.snapshotFile),
          let data = try? Data(contentsOf: url),
          let snap = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    else {
      return .empty
    }
    return snap
  }

  public static func saveSnapshot(_ snapshot: WidgetSnapshot) throws {
    guard let url = containerURL?.appendingPathComponent(WidgetConstants.snapshotFile) else {
      throw StoreError.noContainer
    }
    let data = try JSONEncoder().encode(snapshot)
    try data.write(to: url, options: [.atomic])
  }

  public static func loadDrafts() -> [WidgetDraft] {
    guard let url = containerURL?.appendingPathComponent(WidgetConstants.draftsFile),
          let data = try? Data(contentsOf: url),
          let drafts = try? JSONDecoder().decode([WidgetDraft].self, from: data)
    else {
      return []
    }
    return drafts
  }

  public static func saveDrafts(_ drafts: [WidgetDraft]) throws {
    guard let url = containerURL?.appendingPathComponent(WidgetConstants.draftsFile) else {
      throw StoreError.noContainer
    }
    let data = try JSONEncoder().encode(drafts)
    try data.write(to: url, options: [.atomic])
  }

  public static func appendDraft(_ draft: WidgetDraft) throws {
    var drafts = loadDrafts()
    drafts.append(draft)
    try saveDrafts(drafts)
  }

  public static func clearDrafts() throws {
    try saveDrafts([])
  }

  public static func reloadAllTimelines() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  public enum StoreError: Error {
    case noContainer
  }
}
