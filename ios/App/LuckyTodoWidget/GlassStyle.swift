import SwiftUI
import WidgetKit

enum GlassTheme {
  static let accent = Color(red: 0.36, green: 0.55, blue: 1.0)
  static let textPrimary = Color.primary
  static let textSecondary = Color.secondary

  @ViewBuilder
  static func background() -> some View {
    ZStack {
      ContainerRelativeShape()
        .fill(.ultraThinMaterial)
      ContainerRelativeShape()
        .fill(
          LinearGradient(
            colors: [
              Color.white.opacity(0.28),
              Color.white.opacity(0.06),
              Color.clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
      ContainerRelativeShape()
        .strokeBorder(Color.white.opacity(0.35), lineWidth: 0.8)
    }
  }
}

struct GlassCardModifier: ViewModifier {
  func body(content: Content) -> some View {
    content
      .padding(14)
      .containerBackground(for: .widget) {
        GlassTheme.background()
      }
  }
}

extension View {
  func luckyGlassContainer() -> some View {
    modifier(GlassCardModifier())
  }
}
