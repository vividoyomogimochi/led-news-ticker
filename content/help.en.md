# How to use LED News Ticker

LED News Ticker is a browser app that scrolls news or any text on a retro LED-style display board.

## Basics

1. Pick a preset from the **Theme** tab and hit "Open ticker" — that's it!
2. Want something custom? Open the **Customize** tab to set your own RSS feed URL, colors, and more.

## Source types

### RSS feed

Point it at any RSS/Atom feed URL and the article titles will scroll across the LED board. You can also configure the fetch interval (in minutes).

### WebSocket

Connect to a WebSocket server to receive text in real time. Send either JSON (`{"text": "...", "type": "normal"}`) or plain text.

### SSE (Server-Sent Events)

Connect to an SSE endpoint to receive text in real time. The data format is the same as WebSocket — JSON (`{"text": "...", "type": "normal"}`) or plain text. Since SSE rides on plain HTTP, it's easy to push from existing web servers or serverless environments.

## Use cases

### As a live wallpaper

With tools like [Lively Wallpaper](https://www.rocksdanister.com/lively/), you can point them at the ticker URL and run it as a permanent desktop wallpaper.

1. Open Lively Wallpaper
2. "Add URL" and paste the ticker URL
3. Set as wallpaper!

### As a streaming / broadcast overlay

Add it as a "browser source" in OBS Studio or similar streaming software to overlay news headlines on your stream.

1. In OBS, add "Source" → "Browser"
2. Paste the ticker URL
3. Adjust the width and height to fit your stream layout

### Just open it in your browser

Pick a theme on the config page, hit open, and enjoy a news ticker right in a browser tab. Some themes even come with BGM.
