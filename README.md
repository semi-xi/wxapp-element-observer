# 小程序分屏加载实践

在小程序不断迭代的时候，很容易遇到首屏渲染问题。这种问题，可能出现的原因是：小程序包太大，资源需要加载；网络环境太差，下载速度太慢；渲染节点太多，渲染耗时。  

针对小程序首次加载包的问题，小程序提出了分包加载的功能，这里不做详细描述，可以去看下[官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)  

这里我选择的是针对渲染节点去做优化。

## 技术方案

在微信的API文档里面，有一个判断节点与可视区域的API

> IntersectionObserver 对象，用于推断某些节点是否可以被用户看见、有多大比例可以被用户看见  

这个时候就在想，能不能建立`IntersectionObserver`跟组件之间的关系，使得组件进入可视区域的时候，就显示自己的内容，否则隐藏自己，这样达到动态加载模块的目的。  
  
``` js
// 伪代码
// 建立监听
element.observer()

// 处理进入
observer.handleEnterView(() => {
  callback() // 处理回调
  disconnect() // 销毁
})


```

``` html
<!-- component -->
<view class="component">
  <view class="component-header"></view>
  <view class="component-observer" wx:if="{{ observer_status}}"></view>
  <view class="component-content" wx:else>
    <!-- your content -->
  </view>
</view>
```
  
## 开发阶段

建立了基本技术方案之后，就开始到代码层面了

```js
Component({
  data: {
    observer_status: true
  },
  // 在ready写是因为组件在这个时候，才在视图层布局完成
  ready () {
    // 因为我们是把设备的整个可视区域当成了观参照区域，所以这里直接选择relativeToViewport，如果需要其他的观察区域可以调用relativeTo选择参照区域
    this.observer = this.createIntersectionObserver().relativeToViewport()
    // 我这里的做法是，只要观察的节点进入了可视区域，就显示自己本身的内容
    // 实际上这个observer的回调触发时机是观察节点进入或者离开可视区域，我这里选择的是，只要执行了就显示这个区域，并且关闭这个观察
    this.observer.observe('.observer', (res) => {
      this.setData({
        observer_status: false
      })
      this.observer.disconnect()
      this.observer = null
    })
  },
  detached () {
    // 如果未进入可视区域就离开了，也需要销毁自己的观察
    this.observer && this.observer.disconnect()
  }
})
```

## 优化

你们以为这就完了么，并没有。

对于一个小程序页面，它是可以由template或者Component组成的。对于template来说，需要在Page里面定义，而且如果观察的东西比较多的话，需要设置`observeAll:all`，但是官方文档里面有说同时选中过多节点，将影响渲染性能。 

对于组件开发来说，如果每个组件都这样写的话，是否也会跟`observerAll:all`一样影响渲染性能，还不清楚，如果确实会影响的话也只能减少观察对象，或者把做一个大容器去观察。但是如果每个组件都这样写的话也会非常的繁琐。

这个时候，组件的好处就来了。在定义组件的时候，有一个很神奇的属性，他就是`behaviors`。简单点说，他其实就是一个代码复用机制。直接使用`behaviors`可以使得组件自动获得某些方法，属性。利用这个特性，就可以在组件里面少写很多代码了。

``` js
// mixin.js
module.exports = Behavior({
  data: {
    observer_status: true
  },
  ready () {
    this.observer = this.createIntersectionObserver().relativeToViewport()
    // 自己统一好observer节点的class
    this.observer.observe('.component-observer', (res) => {
      this.setData({
        observer_status: false
      })
      this.observer.disconnect()
      this.observer = null
    })
  },
  detached () {
    this.observer && this.observer.disconnect()
  }
})
```

```js
// Component.js
let mixin = require('你的mixin路径')
Component({
  behaviors: [mixin]
})
```

``` html
<!-- Component.wxml -->
<view class="component">
  <view class="component-header"></view>
  <view class="component-observer" wx:if="{{ observer_status}}"></view>
  <view class="component-content" wx:else>
    <!-- your content -->
  </view>
</view>
```

或者你可以把整个observer做成组件，这样去减少observer的数量，内聚一些模块

``` html
<!-- Observer.wxml -->
<view class="observer">
  <view class="observer-element" wx:if="{{ observer_status}}"></view>
  <view class="observer-content" wx:else>
    <slot/>
  </view>
</view>
```

需要注意的是对于组件来说，如果observer的话就需要一个观察节点，并且这个观察节点必须是高度不为0的可视对象，如果又想有高度又不想影响页面位置的话可以用一些hack的方法

``` css
.component-observer {
  height: 1rpx;
  margin-top: -1rpx;
}

```

## 后续一些讨论

在使用`IntersectionObserver`的时候，有试过用`hidden`属性。但是实际上，`hiiden`也是会被渲染出来的，只是不显示而已，并不会造成页面加载速度的提升

## 效果图

这里是随便拿的一个demo去弄的，需要的话可以点击[这里](https://github.com/semi-xi/wxapp-element-observer)，或者浏览小程序代码片段`https://developers.weixin.qq.com/s/oV1RFfmY7H4W`
使用之后
![](http://yjmf.bs2dl.yy.com/MzRiNTQ5ZTQtNTI2Mi00YTE0LTk3MzEtNWRmYzY2MTY2YTJl.gif)

使用之前
![](http://yjmf.bs2dl.yy.com/Zjc5MDQ3NzEtNDEyYS00YTk1LWI5MjItMzlkMmQxMjAzZmFk.gif)

## 后续进阶

### 图片lazyload方案

image有一个`lazy-load`的属性，但是它只能在page以及在scroll-view使用，如果在其他地方的话是不是也可以用这个去做呢

```html
<!-- image-compponent -->
<view class="observer-picture">
  <image src="{{ _src }}"></image>
</view>
```

```js
// image-component js
Component({
  properties:{
    imageSrc: {
      type: String,
      value: '',
    },

  },
  data: {
    _src: "default_image"
  },
  ready () {
    // 伪代码
    observer('.observer-picture')
      .then(() => {
        this.setData({
          _src: this.properties.imageSrc
        })
      })
  }
})
```

### 滚动到底部/顶部

对于在普通view里面，如果需要做到底加载的话有scroll-view去做，但是这个性能会比较差，容易出现卡顿，这样也可以自己封装一层之后用这个去实现


