import AppIntents
import WidgetKit
import Foundation

@available(iOS 17.0, *)
struct AddTodoIntent: AppIntent {
  static var title: LocalizedStringResource = "添加待办"
  static var description = IntentDescription("在选中日期快速添加一条待办")
  static var openAppWhenRun: Bool = false

  @Parameter(title: "日期")
  var day: String

  init() {
    self.day = FamilyCalendarView.dayKey(Date())
  }

  init(day: String) {
    self.day = day
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let label = "新待办"
    let draft = WidgetDraft(
      id: UUID().uuidString,
      title: label,
      kind: "todo",
      day: day,
      startTime: nil,
      createdAt: ISO8601DateFormatter().string(from: Date())
    )
    try WidgetStore.appendDraft(draft)

    // Optimistically reflect in snapshot day items
    var snap = WidgetStore.loadSnapshot()
    var items = snap.dayItems[day] ?? []
    items.insert(
      WidgetDayItem(
        id: draft.id,
        entityId: draft.id,
        entityType: "todo",
        title: draft.title,
        timeLabel: "待办"
      ),
      at: 0
    )
    snap.dayItems[day] = items
    if !snap.markedDays.contains(day) { snap.markedDays.append(day) }
    snap.updatedAt = draft.createdAt
    try? WidgetStore.saveSnapshot(snap)
    WidgetStore.reloadAllTimelines()

    return .result(dialog: "已添加「\(label)」，打开 App 可继续编辑")
  }
}

@available(iOS 17.0, *)
struct AddEventIntent: AppIntent {
  static var title: LocalizedStringResource = "添加日程"
  static var openAppWhenRun: Bool = false

  @Parameter(title: "日期")
  var day: String

  init() {
    self.day = FamilyCalendarView.dayKey(Date())
  }

  init(day: String) {
    self.day = day
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let draft = WidgetDraft(
      id: UUID().uuidString,
      title: "新日程",
      kind: "event",
      day: day,
      startTime: "09:00",
      createdAt: ISO8601DateFormatter().string(from: Date())
    )
    try WidgetStore.appendDraft(draft)
    WidgetStore.reloadAllTimelines()
    return .result(dialog: "已添加日程草稿")
  }
}
