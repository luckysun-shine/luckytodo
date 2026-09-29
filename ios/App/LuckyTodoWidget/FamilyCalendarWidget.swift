import WidgetKit
import SwiftUI
import AppIntents

struct FamilyCalendarWidget: Widget {
  let kind = "FamilyCalendarWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      FamilyCalendarView(entry: entry)
    }
    .configurationDisplayName("家庭日历")
    .description("浏览日程落点，并在选中日直接添加")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

struct FamilyCalendarView: View {
  var entry: SnapshotEntry
  @Environment(\.widgetFamily) private var family

  private var todayKey: String {
    Self.dayKey(Date())
  }

  var body: some View {
    let snap = entry.snapshot
    Group {
      if !snap.loggedIn {
        LoggedOutView()
      } else if family == .systemLarge {
        largeCalendar(snap)
      } else {
        mediumCalendar(snap)
      }
    }
    .luckyGlassContainer()
  }

  private func mediumCalendar(_ snap: WidgetSnapshot) -> some View {
    let day = todayKey
    let items = (snap.dayItems[day] ?? []).prefix(3)
    return VStack(alignment: .leading, spacing: 8) {
      HStack {
        VStack(alignment: .leading, spacing: 2) {
          Text(monthTitle(Date()))
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
          Text("今天")
            .font(.headline)
        }
        Spacer()
        if #available(iOS 17.0, *) {
          Button(intent: AddTodoIntent(day: day)) {
            Image(systemName: "plus.circle.fill")
              .font(.title2)
              .symbolRenderingMode(.hierarchical)
              .foregroundStyle(GlassTheme.accent)
          }
          .buttonStyle(.plain)
        } else {
          Link(destination: URL(string: "luckytodo://create?type=todo&day=\(day)")!) {
            Image(systemName: "plus.circle.fill")
              .font(.title2)
              .foregroundStyle(GlassTheme.accent)
          }
        }
      }

      WeekStripView(marked: Set(snap.markedDays), selected: day)

      if items.isEmpty {
        Text("今天还没有安排")
          .font(.caption)
          .foregroundStyle(.secondary)
      } else {
        ForEach(Array(items)) { item in
          Link(destination: URL(string: "luckytodo://item?type=\(item.entityType)&id=\(item.entityId)")!) {
            HStack {
              Text(item.timeLabel.isEmpty ? "全天" : item.timeLabel)
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: 36, alignment: .leading)
              Text(item.title)
                .font(.caption.weight(.medium))
                .lineLimit(1)
              Spacer(minLength: 0)
            }
          }
        }
      }
      Spacer(minLength: 0)
    }
  }

  private func largeCalendar(_ snap: WidgetSnapshot) -> some View {
    let day = todayKey
    let items = snap.dayItems[day] ?? []
    return VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text(monthTitle(Date()))
          .font(.headline)
        Spacer()
        if #available(iOS 17.0, *) {
          Button(intent: AddTodoIntent(day: day)) {
            Label("添加", systemImage: "plus")
              .font(.caption.weight(.semibold))
              .padding(.horizontal, 10)
              .padding(.vertical, 6)
              .background(Capsule().fill(Color.white.opacity(0.82)))
              .foregroundStyle(Color(red: 0.09, green: 0.14, blue: 0.24))
          }
          .buttonStyle(.plain)
        }
      }

      MonthGridView(marked: Set(snap.markedDays), selected: day)

      Text("今日事项")
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.secondary)

      if items.isEmpty {
        Text("点右上角添加待办或日程")
          .font(.caption)
          .foregroundStyle(.secondary)
      } else {
        ForEach(items.prefix(4)) { item in
          Link(destination: URL(string: "luckytodo://item?type=\(item.entityType)&id=\(item.entityId)")!) {
            HStack(spacing: 8) {
              Circle().fill(GlassTheme.accent).frame(width: 6, height: 6)
              Text(item.title).font(.caption.weight(.medium)).lineLimit(1)
              Spacer()
              Text(item.timeLabel).font(.caption2).foregroundStyle(.secondary)
            }
          }
        }
      }
      Spacer(minLength: 0)
    }
  }

  private func monthTitle(_ date: Date) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "zh_CN")
    f.dateFormat = "M月"
    return f.string(from: date)
  }

  static func dayKey(_ date: Date) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone.current
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
  }
}

struct WeekStripView: View {
  var marked: Set<String>
  var selected: String

  var body: some View {
    let days = Self.weekDays()
    HStack(spacing: 4) {
      ForEach(days, id: \.self) { key in
        let d = Self.date(from: key)
        let dayNum = Calendar.current.component(.day, from: d)
        VStack(spacing: 4) {
          Text(Self.weekdayLabel(d))
            .font(.system(size: 9, weight: .medium))
            .foregroundStyle(.secondary)
          Text("\(dayNum)")
            .font(.caption2.weight(key == selected ? .bold : .regular))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(
              RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(key == selected ? Color.white.opacity(0.88) : (marked.contains(key) ? GlassTheme.accent.opacity(0.35) : Color.clear))
            )
            .foregroundStyle(key == selected ? Color(red: 0.1, green: 0.14, blue: 0.24) : .primary)
        }
      }
    }
  }

  static func weekDays() -> [String] {
    let cal = Calendar.current
    let today = Date()
    let weekday = cal.component(.weekday, from: today) // 1=Sun
    let mondayOffset = (weekday + 5) % 7
    guard let monday = cal.date(byAdding: .day, value: -mondayOffset, to: today) else { return [] }
    return (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: monday).map(FamilyCalendarView.dayKey) }
  }

  static func date(from key: String) -> Date {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f.date(from: key) ?? Date()
  }

  static func weekdayLabel(_ date: Date) -> String {
    let map = ["日", "一", "二", "三", "四", "五", "六"]
    let i = Calendar.current.component(.weekday, from: date) - 1
    return map[i]
  }
}

struct MonthGridView: View {
  var marked: Set<String>
  var selected: String

  var body: some View {
    let cells = Self.monthCells()
    VStack(spacing: 4) {
      HStack {
        ForEach(["一", "二", "三", "四", "五", "六", "日"], id: \.self) { w in
          Text(w).font(.system(size: 9)).foregroundStyle(.secondary).frame(maxWidth: .infinity)
        }
      }
      ForEach(0..<(cells.count / 7), id: \.self) { row in
        HStack(spacing: 2) {
          ForEach(0..<7, id: \.self) { col in
            let idx = row * 7 + col
            let key = cells[idx]
            if let key {
              Text(String(Int(key.suffix(2)) ?? 0))
                .font(.system(size: 10, weight: key == selected ? .bold : .regular))
                .frame(maxWidth: .infinity, minHeight: 18)
                .background(
                  RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(key == selected ? Color.white.opacity(0.88) : (marked.contains(key) ? GlassTheme.accent.opacity(0.35) : Color.clear))
                )
                .foregroundStyle(key == selected ? Color(red: 0.1, green: 0.14, blue: 0.24) : .primary)
            } else {
              Text("").frame(maxWidth: .infinity, minHeight: 18)
            }
          }
        }
      }
    }
  }

  static func monthCells() -> [String?] {
    let cal = Calendar.current
    let now = Date()
    guard let start = cal.date(from: cal.dateComponents([.year, .month], from: now)) else { return [] }
    let pad = (cal.component(.weekday, from: start) + 5) % 7 // Monday-first
    let days = cal.range(of: .day, in: .month, for: now)?.count ?? 30
    var cells: [String?] = Array(repeating: nil, count: pad)
    for d in 1...days {
      if let date = cal.date(byAdding: .day, value: d - 1, to: start) {
        cells.append(FamilyCalendarView.dayKey(date))
      }
    }
    while cells.count % 7 != 0 { cells.append(nil) }
    return cells
  }
}
