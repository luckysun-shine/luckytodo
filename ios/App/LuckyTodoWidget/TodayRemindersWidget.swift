import WidgetKit
import SwiftUI
import AppIntents

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> SnapshotEntry {
    SnapshotEntry(date: Date(), snapshot: demoSnapshot())
  }

  func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
    let snap = WidgetStore.loadSnapshot()
    completion(SnapshotEntry(date: Date(), snapshot: snap.loggedIn ? snap : demoSnapshot()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
    let snap = WidgetStore.loadSnapshot()
    let entry = SnapshotEntry(date: Date(), snapshot: snap)
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func demoSnapshot() -> WidgetSnapshot {
    WidgetSnapshot(
      updatedAt: ISO8601DateFormatter().string(from: Date()),
      loggedIn: true,
      memberName: "示例",
      reminders: [
        WidgetReminder(id: "1", entityId: "1", entityType: "plan", title: "阅读打卡", timeLabel: "20:00", sortKey: "20:00", done: false),
        WidgetReminder(id: "2", entityId: "2", entityType: "todo", title: "交电费", timeLabel: "18:00", sortKey: "18:00", done: false)
      ],
      markedDays: [],
      dayItems: [:]
    )
  }
}

struct SnapshotEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot
}

// MARK: - Today Reminders

struct TodayRemindersWidget: Widget {
  let kind = "TodayRemindersWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      TodayRemindersView(entry: entry)
    }
    .configurationDisplayName("今日提醒")
    .description("今天要提醒或待处理的事项")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

struct TodayRemindersView: View {
  var entry: SnapshotEntry

  var body: some View {
    let snap = entry.snapshot
    Group {
      if !snap.loggedIn {
        LoggedOutView()
      } else if snap.reminders.filter({ !$0.done }).isEmpty {
        EmptyRemindersView()
      } else {
        let open = snap.reminders.filter { !$0.done }.sorted { $0.sortKey < $1.sortKey }
        switch widgetFamilyCompat {
        case .systemSmall:
          smallView(open)
        case .systemLarge:
          listView(Array(open.prefix(8)))
        default:
          listView(Array(open.prefix(5)))
        }
      }
    }
    .luckyGlassContainer()
  }

  @Environment(\.widgetFamily) private var family
  private var widgetFamilyCompat: WidgetFamily { family }

  private func smallView(_ items: [WidgetReminder]) -> some View {
    let first = items[0]
    return VStack(alignment: .leading, spacing: 6) {
      Text("今日提醒")
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.secondary)
      Text("\(first.timeLabel) \(first.title)")
        .font(.headline)
        .lineLimit(2)
      Text(items.count > 1 ? "今日还有 \(items.count - 1) 条提醒" : "今天就这一条")
        .font(.caption)
        .foregroundStyle(.secondary)
      Spacer(minLength: 0)
    }
    .widgetURL(URL(string: "luckytodo://home?tab=today"))
  }

  private func listView(_ items: [WidgetReminder]) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text("今日提醒")
          .font(.caption.weight(.semibold))
          .foregroundStyle(.secondary)
        Spacer()
        Text("\(items.count)")
          .font(.caption2.monospacedDigit())
          .padding(.horizontal, 7)
          .padding(.vertical, 3)
          .background(Capsule().fill(Color.white.opacity(0.18)))
      }
      ForEach(items) { item in
        Link(destination: URL(string: "luckytodo://item?type=\(item.entityType)&id=\(item.entityId)")!) {
          HStack(spacing: 10) {
            Text(item.timeLabel)
              .font(.caption.monospacedDigit())
              .foregroundStyle(.secondary)
              .frame(width: 42, alignment: .leading)
            Circle()
              .fill(GlassTheme.accent)
              .frame(width: 7, height: 7)
              .shadow(color: GlassTheme.accent.opacity(0.6), radius: 4)
            Text(item.title)
              .font(.subheadline.weight(.medium))
              .lineLimit(1)
            Spacer(minLength: 0)
          }
          .padding(.vertical, 4)
          .padding(.horizontal, 8)
          .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white.opacity(0.10)))
        }
      }
      Spacer(minLength: 0)
    }
  }
}

struct EmptyRemindersView: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("今日提醒")
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
      Text("今天没有待提醒事项")
        .font(.subheadline.weight(.semibold))
      Text("打开 App 新建待办或计划")
        .font(.caption)
        .foregroundStyle(.secondary)
      Spacer(minLength: 0)
    }
    .widgetURL(URL(string: "luckytodo://home?tab=today"))
  }
}

struct LoggedOutView: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("LuckyTodo")
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
      Text("打开 App 登录")
        .font(.headline)
      Text("登录后组件会显示家庭提醒与日历")
        .font(.caption)
        .foregroundStyle(.secondary)
      Spacer(minLength: 0)
    }
    .widgetURL(URL(string: "luckytodo://home"))
  }
}
