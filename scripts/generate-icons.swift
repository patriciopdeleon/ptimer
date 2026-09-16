import AppKit

// Run from the project root: swift scripts/generate-icons.swift
enum IconError: Error {
    case bitmapCreationFailed
    case contextCreationFailed
    case fontUnavailable
    case pngEncodingFailed
}

let icons = [
    (size: 192, name: "icon-192.png"),
    (size: 512, name: "icon-512.png"),
    (size: 180, name: "apple-touch-icon.png"),
]
let panelColors = [
    NSColor(srgbRed: 212 / 255, green: 214 / 255, blue: 216 / 255, alpha: 1),
    NSColor(srgbRed: 227 / 255, green: 229 / 255, blue: 231 / 255, alpha: 1),
    NSColor(srgbRed: 241 / 255, green: 242 / 255, blue: 243 / 255, alpha: 1),
]
let textColor = NSColor(srgbRed: 36 / 255, green: 38 / 255, blue: 41 / 255, alpha: 1)
let outputDirectory = URL(fileURLWithPath: "dist/icons", isDirectory: true)

try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

for icon in icons {
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: icon.size,
        pixelsHigh: icon.size,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        throw IconError.bitmapCreationFailed
    }
    guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        throw IconError.contextCreationFailed
    }

    NSGraphicsContext.saveGraphicsState()
    defer { NSGraphicsContext.restoreGraphicsState() }
    NSGraphicsContext.current = context

    let width = CGFloat(icon.size)
    for (index, color) in panelColors.enumerated() {
        color.setFill()
        NSRect(
            x: 0,
            y: CGFloat(index) * width / 3,
            width: width,
            height: width / 3 + 1
        ).fill()
    }

    guard let font = NSFont(name: "HelveticaNeue-Light", size: width * 0.215) else {
        throw IconError.fontUnavailable
    }
    let label = NSAttributedString(
        string: "00:00",
        attributes: [.font: font, .foregroundColor: textColor]
    )
    let bounds = label.size()
    label.draw(at: NSPoint(x: (width - bounds.width) / 2, y: (width - bounds.height) / 2))

    guard let pngData = bitmap.representation(using: .png, properties: [:]) else {
        throw IconError.pngEncodingFailed
    }
    try pngData.write(to: outputDirectory.appendingPathComponent(icon.name))
}
