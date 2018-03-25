"use strict";

var testImagePath = 'img/innerspeaker.jpg';

var canvasWrapperId = 'canvas-wrapper';
var canvasId = 'canvas';

var drosteCanvas = new DrosteCanvas(canvasId, canvasWrapperId);
function DrosteCanvas(canvasId, containerId) {

  this.canvasId = canvasId;

  this.canvasEl = document.getElementById(canvasId);
  this.containerEl = document.getElementById(containerId);

  this.stage = undefined;

  this.init = function() {
    this.stage = new createjs.Stage(this.canvasId);
  };

  this.clear = function() {
    this.init();
  };

  this.resizeToContainer = function() {
    this.canvasEl.width = this.containerEl.clientWidth;
    this.canvasEl.height = this.containerEl.clientHeight;
  };

  this.renderImage = function(image) {
    renderBitmap(this.stage, new createjs.Bitmap(image));
  };

  this.getImageData = function() {

    // TODO Need to duplicate canvas element, clip it, and then call
    // toDataURL on that canvas.
    return this.canvasEl.toDataURL('image/png', 1);
  };

  this.downloadImage = function(link) {

    link.href = this.getImageData();

    // TODO Use the original file name 
    link.download = 'innerdroste.png';

  }

}

function loadImage(src, onLoad) {

  var image = new Image();
  image.src = src;
  image.onload = function() {
    onLoad(image);
  };

}

function onFileChange(files) {

  var file = files[0];
  if (!file) {
    return;
  }

  // Clear the canvas.
  drosteCanvas.clear();

  // Resize the container.
  drosteCanvas.resizeToContainer();

  // Initialize a reader for the file.
  var reader = new FileReader();  
  reader.onload = function(event) {

    // Create a new image from the base64 encoded result of the reader, and
    // render it.
    loadImage(event.target.result, function(image) {
      drosteCanvas.renderImage(image);
    });

  };

  reader.readAsDataURL(file);

}

function renderBitmap(stage, bitmap) {

  var image = bitmap.image;

  var width = stage.canvas.width;
  var height = stage.canvas.height;

  // // Calculate the ratio of the image to the canvas.
  var xRatio = width / image.width;
  var yRatio = height / image.height;

  // Take whichever ratio is smaller.
  var scale = Math.min(xRatio, yRatio);

  // Scale the bitmap.
  bitmap.scaleX = scale;
  bitmap.scaleY = scale;

  // Centers the image within the canvas.
  bitmap.x = (width - image.width * scale) / 2;
  bitmap.y = (height - image.height * scale) / 2;

  // Add it and update (drawing it).
  stage.addChild(bitmap);
  stage.update();

  // Crop the original bitmap by 25% first.
  var croppedBitmap = cropScaledBitmap(bitmap, 0.75);
  var dimensions = getScaledDimensions(croppedBitmap);
  var circularMask = createCircularMask(
    croppedBitmap.x, croppedBitmap.y, dimensions.width, dimensions.height);
  croppedBitmap.mask = circularMask;      
  stage.addChild(croppedBitmap);
  stage.update();

  // Draw 10 smaller versions on top, each 12% smaller.
  // TODO start, end, and interval should be configurable by the user
  // TODO 0.12 should be configurable
  for (var i=0.9; i>0; i -= 0.17){

    var scaledBitmap = createCenteredScaledBitmap(
      croppedBitmap, width, height, image.width, image.height, scale, i);

    // Reduce the opacity of it, but only if it's below a threshold.
    if (i < 1) {
      // TODO 0.1 should be a modifier, by user
      scaledBitmap.alpha = i + 0.3; 
    }

    // TODO Only apply the mask if 'circular' is selected.
    var dimensions = getScaledDimensions(scaledBitmap);

    var circularMask = createCircularMask(
      scaledBitmap.x, scaledBitmap.y, dimensions.width, dimensions.height);
    scaledBitmap.mask = circularMask;      

    stage.addChild(scaledBitmap);
    stage.update();

  }    

}

/**
 * Takes a bitmap, crops a rectangle of specified scale, and centers that within
 * the original bitmap.
 * 
 * @param  {[type]} bitmap       [description]
 * @param  {[type]} canvasWidth  [description]
 * @param  {[type]} canvasHeight [description]
 * @param  {[type]} scale        [description]
 * @return {[type]}              [description]
 */
function cropScaledBitmap(bitmap, scale) {

  var croppedBitmap = bitmap.clone();

  // The width/height of the bounds are not accurate -- they represent
  // the size of the original bitmap. We need to apply the scales
  // to get the true dimensions.
  var bounds = bitmap.getBounds();
  var containerWidth = bounds.width * bitmap.scaleX;
  var containerHeight = bounds.height * bitmap.scaleY;

  // Create scaled dimensions for the cropped image.
  var width = containerWidth * scale;
  var height = containerHeight * scale;

  // This will center the cropped image inside the bitmap.
  var cropX = (containerWidth - width) / 2;
  var cropY = (containerHeight - height) / 2;

  // Only this rectangle within the bitmap will be drawn.
  // This part is really confusing, but we need to apply 
  // different width/height here using the original scaling. This
  // is because the existing scale of the bitmap is applied to
  // whatever width/height we pass in. But if we reset the scale of the 
  // croppedBitmap object to 1, the sourceRect we draw is only a portion 
  // of the unscaled bitmap, and not the scaled bitmap.
  // Hopefully that makes sense.
  croppedBitmap.sourceRect = new createjs.Rectangle(
    cropX, cropY, bounds.width * scale, bounds.height * scale);

  // The x and y co-ordinates are relative to the bitmaps parent stage.
  // So, we need to offset the x/y of the cropped image by those co-ordinates.
  croppedBitmap.x = bitmap.x + cropX;
  croppedBitmap.y = bitmap.y + cropY;

  return croppedBitmap;

}

function createCircularMask(x, y, width, height) {
  return new createjs.Shape(new createjs.Graphics().drawEllipse(x, y, width, height));
}

function createCenteredScaledBitmap(bitmap, canvasWidth, canvasHeight, imageWidth, imageHeight, originalScale, scale) {

  var scaledBitmap = bitmap.clone();

  // The width/height of the bounds are not accurate -- they represent
  // the size of the original bitmap. We need to apply the scales
  // to get the true dimensions.
  var containerDimensions = getScaledDimensions(bitmap);

  // We can use the X scale assuming both X and Y are the same.
  var bitmapScale = originalScale * scale;
  scaledBitmap.scaleX = scaledBitmap.scaleY = bitmapScale;

  // Calculate the new dimensions of this smaller bitmap.
  var scaledDimensions = getScaledDimensions(scaledBitmap);

  // x and y are already offset -- we just need to increment them by
  // half the difference in width/height between the original bitmap
  // and the smaller, scaled one
  var centeredCoords = 
    getCenteredCoordinates(containerDimensions, scaledDimensions, bitmap.x, bitmap.y);
  scaledBitmap.x = centeredCoords.x;
  scaledBitmap.y = centeredCoords.y;

  return scaledBitmap;

}

function getCenteredCoordinates(parentDimensions, childDimensions, xOffset, yOffset) {

  return {
    x: xOffset + ((parentDimensions.width - childDimensions.width) / 2),
    y: yOffset + ((parentDimensions.height - childDimensions.height) / 2)
  };
  
}

/**
 * Helper function to return the actual, scaled dimensions
 * of the displayed bitmap.
 * @param  {[type]} bitmap [description]
 * @return {[type]}        [description]
 */
function getScaledDimensions(bitmap) {

  var bounds = bitmap.getBounds();
  return { 
    width: bounds.width * bitmap.scaleX, 
    height: bounds.height * bitmap.scaleY 
  };

}

/**
 * Adds all event listeners for user interaction.
 */
function addEventListeners() {

  function addEventListenerToElem(elemId, event, callback) {
    document.getElementById(elemId).addEventListener(event, callback);
  };

  addEventListenerToElem('file-input', 'change', function() {
    onFileChange(this.files);
  });

  addEventListenerToElem('download', 'click', function() {
    drosteCanvas.downloadImage(this);
  });

}

/**
 * Initializes the app - adds event listenres for buttons,
 * initializes the canvases and resizes it to fit the window,
 * and loads the default test image.
 */
function initialize() {

  addEventListeners();

  drosteCanvas.init();
  drosteCanvas.resizeToContainer();

  loadImage(testImagePath, function(image) {
    drosteCanvas.renderImage(image);
  });

}