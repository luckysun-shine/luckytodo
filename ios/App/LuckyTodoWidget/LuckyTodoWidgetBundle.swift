import WidgetKit
import SwiftUI

@main
struct LuckyTodoWidgetBundle: WidgetBundle {
  var body: some Widget {
    TodayRemindersWidget()
    FamilyCalendarWidget()
  }
}
