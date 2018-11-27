
module.exports = Behavior({
  data: {
    observer_status: true,
    testList: new Array(20)
  },
  ready () {
    this.observer = this.createIntersectionObserver().relativeToViewport()
    this.observer.observe('.observer', (res) => {
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