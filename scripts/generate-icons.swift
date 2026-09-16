import AppKit

// Run from the project root: swift scripts/generate-icons.swift
for (size, name) in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")] {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    let context = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    let width = CGFloat(size)
    let colors: [(CGFloat, CGFloat, CGFloat)] = [(212,214,216),(227,229,231),(241,242,243)]
    for (index, rgb) in colors.enumerated() {
        NSColor(srgbRed: rgb.0/255, green: rgb.1/255, blue: rgb.2/255, alpha: 1).setFill()
        NSRect(x: 0, y: CGFloat(index)*width/3, width: width, height: width/3+1).fill()
    }
    let font = NSFont(name: "HelveticaNeue-Light", size: width*0.215)!
    let label = NSAttributedString(string: "00:00", attributes: [.font: font, .foregroundColor: NSColor(srgbRed: 36/255, green: 38/255, blue: 41/255, alpha: 1)])
    let bounds = label.size()
    label.draw(at: NSPoint(x: (width-bounds.width)/2, y: (width-bounds.height)/2))
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "dist/icons/\(name)"))
}
