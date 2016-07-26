'use strict';

/*
 * goal: use a Scrubber object in DalSegno, only one attribute
 *
 * update the scrubber with numFrames
 * set callback for onInput (maybe it even knows which frames are which?)
 * add event listener to element
 * set min, max based on number of frames
 *
 */

function Scrubber(id){
  this.id = id;
  this.rangeElement = document.getElementById(id);

  this.rangeElement.min = 0;
  this.rangeElement.max = 100;
  this.rangeElement.value = 40;
  this.rangeElement.addEventListener('input', ()=> this.onInput() );

  this.coverer = this.makeCoverer();
  this.cover(0);

  this.prevValue = parseInt(this.rangeElement.value);
}
/** Make current value the max with an animation */
Scrubber.prototype.dropBeyond = function(cb){
  if (this.rangeElement.value === this.rangeElement.max){ return; }

  this.rangeElement.disabled = true;
  var spot = parseInt(this.rangeElement.value);
  console.log('cutting beyond', spot);
  this.cover(1 - spot / parseInt(this.rangeElement.max));
  this.disappear(()=>{
    this.expand(()=>{
      cb();
      this.rangeElement.disabled = false;
    });
  });
};
Scrubber.prototype.update = function(numFrames, curFrame){
  this.rangeElement.min = 0;
  this.rangeElement.max = numFrames + 1;
  this.rangeElement.value = curFrame + 1;
};
/** called by input handler */
Scrubber.prototype.onInput = function(e){
  var val = parseInt(this.rangeElement.value);
  var msg;
  if (this.rangeElement.value === this.rangeElement.min){
    msg = 'first';
  } else if (this.rangeElement.value === this.rangeElement.max){
    msg = 'last';
  } else {
    msg = val - 1;
  }
  if (typeof this.callback !== 'undefined'){
    this.callback(msg);
  }
};
Scrubber.prototype.setCurrentIndex = function(val){
  this.rangeElement.value = val + 1;
};
Scrubber.prototype.makeCoverer = function(){
  var c = document.createElement('div');
  c.style.background = '#eef';
  var els = window.getComputedStyle(this.rangeElement);
  c.style.position = els.position=='fixed' ? 'fixed':'absolute';
  c.style.zIndex = parseInt(els.zIndex)+1;
  document.body.appendChild(c);
  c.style.width = this.rangeElement.offsetWidth;
  c.style.height = this.rangeElement.offsetHeight;
  c.style.left = this.rangeElement.offsetLeft;
  c.style.top = this.rangeElement.offsetTop;
  this.origSliderWidth = parseInt(this.rangeElement.offsetWidth);
  this.origSliderLeft = parseInt(this.rangeElement.offsetLeft);
  return c;
};
Scrubber.prototype.cover = function(fraction){
  var radius = 7.5; // magic number
  this.coverer.style.width = (this.origSliderWidth - 2*radius) * fraction;
  this.coverer.style.left = this.origSliderLeft + (this.origSliderWidth - 2*radius) * (1 - fraction) + 2*radius;
};
Scrubber.prototype.disappear = function(cb){
  this.coverer.style.opacity = 0;
  this._disappear(cb);
};
Scrubber.prototype._disappear = function(cb){
  var opacity = parseFloat(this.coverer.style.opacity);
  if (opacity === 1){
    return cb();
  } else {
    this.coverer.style.opacity = Math.min(1, opacity + 0.01);
    setTimeout(()=>this._disappear(cb), 10);
  }
};
Scrubber.prototype.expand = function(cb){
  var delta = 1;
  if (this.rangeElement.max === this.rangeElement.value){
    return cb();
  } else {
    var dest = Math.max(parseInt(this.rangeElement.value), parseInt(this.rangeElement.max) - delta);
    this.rangeElement.max = dest;
    this.cover(1 - parseInt(this.rangeElement.value) / dest);
    setTimeout(()=>this.expand(cb), 10);
  }
};

Scrubber.Scrubber = Scrubber;


if (typeof __webpack_require__ === 'function'){
  module.exports = Scrubber;
} else {
  // fine, global Scrubber is the only exported thing
}
