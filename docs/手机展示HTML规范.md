# 手机展示 HTML 规范

## 概述

本文档说明如何编写适合手机横屏全屏展示的 HTML 页面。手机作为"桌面显示器"使用时，页面应充分利用屏幕空间，避免滚动条和多余留白。

## 设备特性

- **方向**：横屏放置（landscape）
- **展示方式**：全屏显示，无浏览器地址栏和工具栏
- **交互**：无用户交互，纯展示用途

## HTML 模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>展示页面</title>
  <style>
    /* 重置默认样式 */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    /* 主容器：占满全屏 */
    .container {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* 内容区域 */
    .content {
      width: 100%;
      height: 100%;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <!-- 你的内容 -->
      <h1>欢迎</h1>
    </div>
  </div>
</body>
</html>
```

## 关键要点

### 1. Viewport 设置

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

- `width=device-width`：宽度等于设备宽度
- `initial-scale=1.0`：初始缩放比例为 1
- `maximum-scale=1.0`：禁止放大
- `user-scalable=no`：禁止用户缩放

### 2. 全屏布局

```css
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

- 禁止滚动条出现
- 内容应适配屏幕尺寸，避免溢出

### 3. 横屏适配

使用 CSS 媒体查询针对横屏优化：

```css
@media (orientation: landscape) {
  .content {
    flex-direction: row;
  }
}
```

### 4. 字体大小

使用 `vw`/`vh` 单位让字体随屏幕自适应：

```css
h1 {
  font-size: 8vw;
}

p {
  font-size: 3vw;
}
```

### 5. 背景与颜色

- 推荐深色背景（`#000` 或 `#111`），减少屏幕刺眼
- 文字使用高对比度颜色（`#fff` 或 `#eee`）

### 6. 避免的内容

- 不要使用 `position: fixed` 固定元素（可能遮挡内容）
- 不要使用外部链接或需要交互的元素
- 不要使用过小的字体（横屏下难以阅读）

## 示例：信息展示页面

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a0a; color: #fff; font-family: sans-serif; }
    .container { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2vh; }
    .title { font-size: 6vw; font-weight: bold; }
    .subtitle { font-size: 3vw; color: #888; }
    .stats { display: flex; gap: 8vw; margin-top: 4vh; }
    .stat { text-align: center; }
    .stat-value { font-size: 10vw; font-weight: bold; color: #4ade80; }
    .stat-label { font-size: 2.5vw; color: #666; margin-top: 1vh; }
  </style>
</head>
<body>
  <div class="container">
    <div class="title">今日数据</div>
    <div class="subtitle">实时更新</div>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">128</div>
        <div class="stat-label">访问量</div>
      </div>
      <div class="stat">
        <div class="stat-value">56</div>
        <div class="stat-label">订单数</div>
      </div>
      <div class="stat">
        <div class="stat-value">¥9.2k</div>
        <div class="stat-label">销售额</div>
      </div>
    </div>
  </div>
</body>
</html>
```

## 示例：图片轮播页面

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    .slideshow { width: 100vw; height: 100vh; position: relative; }
    .slide { position: absolute; inset: 0; opacity: 0; transition: opacity 1s; }
    .slide.active { opacity: 1; }
    .slide img { width: 100%; height: 100%; object-fit: cover; }
  </style>
</head>
<body>
  <div class="slideshow">
    <div class="slide active"><img src="https://picsum.photos/800/400?random=1" alt=""></div>
    <div class="slide"><img src="https://picsum.photos/800/400?random=2" alt=""></div>
    <div class="slide"><img src="https://picsum.photos/800/400?random=3" alt=""></div>
  </div>
  <script>
    const slides = document.querySelectorAll('.slide');
    let current = 0;
    setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 5000);
  </script>
</body>
</html>
```
