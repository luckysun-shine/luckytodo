import Foundation

public enum WidgetConstants {
  public static let appGroupId = "group.family.luckytodo.app"
  public static let snapshotFile = "widget-snapshot.json"
  public static let draftsFile = "widget-drafts.json"
  public static let suiteName = appGroupId
}

public struct WidgetSnapshot: Codable, Equatable {
  public var updatedAt: String
  public var loggedIn: Bool
  public var memberName: String?
  public var reminders: [WidgetReminder]
  public var markedDays: [String]
  public var dayItems: [String: [WidgetDayItem]]

  public static let empty = WidgetSnapshot(
    updatedAt: "",
    loggedIn: false,
    memberName: nil,
    reminders: [],
    markedDays: [],
    dayItems: [:]
  )
}

public struct WidgetReminder: Codable, Equatable, Identifiable {
  public var id: String
  public var entityId: String
  public var entityType: String
  public var title: String
  public var timeLabel: String
  public var sortKey: String
  public var done: Bool
}

public struct WidgetDayItem: Codable, Equatable, Identifiable {
  public var id: String
  public var entityId: String
  public var entityType: String
  public var title: String
  public var timeLabel: String
}

public struct WidgetDraft: Codable, Equatable, Identifiable {
  public var id: String
  public var title: String
  public var kind: String // todo | event
  public var day: String // YYYY-MM-DD
  public var startTime: String? // HH:mm
  public var createdAt: String
}
