///////////////
// Utilities //
///////////////

/**
 * @typedef {Dimensions}
 * @property {Number} width - Width of the element.
 * @property {Number} height - Height of the element.
 */

/**
 * Given a DOM element's ID, returns the width and
 * height in an object.
 *
 * @param  {String} elementId - Unique element ID.
 * @return {Dimensions} Dimensions object.
 * @throws {Error} If no element is found.
 */
function getElementDimensions(elementId) {
  var element = document.getElementById(elementId);
  if (!element) {
    throw new Error('No element found for ID: ' + elementId);
  }

  return {
    width: element.clientWidth,
    height: element.clientHeight,
  };
}

/**
 * Computes the offset needed to center a child
 * element within its parent (i.e. to use as x/y 
 * co-ordinates).
 *
 * @param {Object} options - Options object.
 * @param {Number} options.parentDimension - Parent dimension.
 * @param {Number} options.childDimension - Child dimension.
 * @param {Number} options.offset - Offset to add to the result.
 *  This is necessary if the parent is NOT the root element, and
 *  may be centered itself.
 * @return {Number} - Centered offset to use for the child element.
 * @throws {Error} If no options are provided.
 */
function computeCenteredOffset(options) {
  if (!options) {
    throw new Error('No options provided');
  }

  var parentDimension = options.parentDimension || 0;
  var childDimension = options.childDimension || 0;
  var offset = options.offset || 0;

  return offset + (parentDimension - childDimension) / 2;
}

/**
 * Adds an event handler to a DOM element.
 *
 * @param {Object} options - Options object.
 * @param {String} options.elementId - Unique element ID.
 * @throws {Error} If no options are provided.
 */
function addEventHandlerToElem(options) {
  if (!options) {
    throw new Error('No options provided');
  }

  var elementId = options.elementId;
  var event = options.event;
  var handler = options.handler;

  var element = document.getElementById(elementId);
  if (!element) {
    throw new Error('No element found for ID: ' + elementId);
  }

  element.addEventListener(event, handler);
}

/**
 * Reads a file to a base 64 string.
 *
 * @param {File} file - File to read.
 * @param {Function} onLoad - Called when the file is read,
 *  with the base 64 encoded string as the only argument.
 * @throws {Error} If no file or callback is provided.
 */
function fileToBase64(file, onLoad) {
  if (!file) {
    throw new Error('No file provided');
  }

  var reader = new FileReader();
  reader.onload = function(event) {
    var base64Src = event.target.result;
    onLoad(base64Src);
  };
  reader.readAsDataURL(file);
}

/**
 * Downloads a URI to a file with a specified name.
 *
 * Credit: https://stackoverflow.com/a/15832662/512042
 *
 * @param {String} uri - URI string.
 * @param {String} name - Downloaded file name.
 */
function downloadURI(uri, name) {
  var link = document.createElement("a");
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  delete link;
}

/////////////
// Classes //
/////////////

/**
 * Rectangular Droste effect strategy class. Given a stage and
 * image, it iteratively generates layers such that each layer
 * is smaller than the last. No clipping is done.
 *
 * It provides a single public method,
 *  {@link RectangularDrosteEffectStrategy#apply}.
 */
function RectangularDrosteEffectStrategy() {
  // Scaling constants, in percentages.
  var scaling = {
    initial: 0.9,
    final: 0, // Exclusive
    interval: 0.15,
  };

  function cloneLayer(layer) {
    // NOTE: This will not clone width/height values.
    return layer.clone();
  }

  function scaleLayer(layer, scale) {
    return layer.clone({
      scaleX: layer.scaleX() * scale,
      scaleY: layer.scaleY() * scale,
    });
  }

  function centerLayer(rootLayer, scaledChildLayer) {
    // This is a bit hacky. When children are cloned,
    // width/height aren't set; they are only set once added
    // to a stage. We want to center them before doing that, though,
    // to avoid that stage in between.
    // We can assume that the root layer HAS been added, though,
    // and use its width/height, as well as the child's scale,
    // to calculate the childs.
    var childWidth = rootLayer.width() * scaledChildLayer.scaleX();
    var childHeight = rootLayer.height() * scaledChildLayer.scaleY();

    return scaledChildLayer.clone({
      x: computeCenteredOffset({
        parentDimension: rootLayer.width(),
        childDimension: childWidth,
        offset: rootLayer.x(),
      }),
      y: computeCenteredOffset({
        parentDimension: rootLayer.height(),
        childDimension: childHeight,
        offset: rootLayer.y(),
      }),
    });
  }

  function generateLayers(stage, rootLayer) {
    var layers = [];
    for (
      var i = scaling.initial;
      i > scaling.final;
      i -= scaling.interval
    ) {
      layers.push(
        centerLayer(
          rootLayer, 
          scaleLayer(
            cloneLayer(rootLayer), i)));
    }
    return layers;
  }

  function addLayersToStage(stage, layers) {
    layers.forEach(function(layer) {
      stage.add(layer);
    });
  }

  /**
   * Applies the effect to a layer and
   * adds all generated layers to the stage.
   *
   * @param {Object} options - Options object.
   * @param {Object} options.stage - Konva stage object.
   * @param {Object} options.rootLayer - Konva layer object.
   */
  this.apply = function(options) {
    var stage = options.stage;
    var rootLayer = options.rootLayer;

    stage.clear();
    stage.add(rootLayer);

    addLayersToStage(
      stage, 
      generateLayers(stage, rootLayer));
  };
}

/**
 * A class for generating an innerdroste-effect
 * canvas within a container.
 *
 * It uses a {@link RectangularDrosteEffectStrategy}.
 *
 * @param {Object} options - Options object.
 * @param {String} options.containerId - Unique DOM element ID.
 */
function DrosteCanvas(options) {  
  var containerId = options.containerId;

  var stage = undefined;
  var stageWidth = 0;
  var stageHeight = 0;

  var effectStrategy = new RectangularDrosteEffectStrategy();

  ////////////////////////
  // Privileged methods //
  ////////////////////////
  
  function calculateImageScale(imageWidth, imageHeight) {
    // Calculate the ratio of the image to the stage so
    // we can scale the image to fit the stage and not overflow.
    var xRatio = stageWidth / imageWidth;
    var yRatio = stageHeight / imageHeight;

    // Take whichever ratio is smaller; this ensures that we scale
    // at the same dimensions ratio
    return Math.min(xRatio, yRatio);
  }
  
  function createImageLayer(imageObj) {
    var imageWidth = imageObj.naturalWidth;
    var imageHeight = imageObj.naturalHeight;
    var scale = calculateImageScale(imageWidth, imageHeight);

    var layer = new Konva.Layer();
    layer.add(new Konva.Image({
      x: computeCenteredOffset({
        parentDimension: stageWidth,
        childDimension: imageWidth * scale,
      }),
      y: computeCenteredOffset({
        parentDimension: stageHeight,
        childDimension: imageHeight * scale,
      }),
      image: imageObj,
      width: imageWidth,
      height: imageHeight,
      scaleX: scale,
      scaleY: scale,
    }));

    return layer;
  }

  function renderImageWithEffect(imageObj) {
    effectStrategy.apply({
      stage: stage,
      rootLayer: createImageLayer(imageObj),
    });
  }

  function updateStageDimensions() {
    var dimensions =
      getElementDimensions(containerId);
    stageWidth = dimensions.width;
    stageHeight = dimensions.height;
  }

  function initStage() {
    stage = new Konva.Stage({
      container: containerId,
      width: stageWidth,
      height: stageHeight,
    });    
  }

  function clearStage() {
    stage.clear();
  }

  ////////////////////
  // Public methods //
  ////////////////////

  /**
   * Initializes the stage.
   */
  this.init = function() {
    updateStageDimensions();
    initStage();
  };

  /**
   * Loads an image into the canvas, applying the effect.
   *
   * @param  {String} imgSrc - Image source.
   */
  this.loadImage = function(imgSrc) {
    clearStage();

    var image = new Image();
    image.src = imgSrc;
    image.onload = renderImageWithEffect.bind(this, image);
  };

  /**
   * Converts the canvas to a base 64 encoded string
   * that can be downloaded.
   *
   * @return {String} - Base 64 encoded string representing
   *  the canvas.
   */
  this.toDataURL = function() {
    return stage.toDataURL();
  }
}

/////////////////
// Entry point //
/////////////////

/**
 * Initializes the canvas with an initial image 
 * and adds event handlers to the action buttons.
 */
function initialize() {
  var drosteCanvas = new DrosteCanvas({
    containerId: 'canvas-container',
  });
  drosteCanvas.init();
  // Display a placeholder image as an example.
  drosteCanvas.loadImage('assets/img/innerspeaker.jpg');

  addEventHandlerToElem({
    elementId: 'file-input',
    event: 'change',
    handler: function() {
      var files = this.files;
      if (!files || !files[0]) {
        return;
      }

      fileToBase64(files[0], drosteCanvas.loadImage.bind(drosteCanvas));
    },
  });

  addEventHandlerToElem({
    elementId: 'download',
    event: 'click',
    handler: function() {
      debugger;
      var dataURL = drosteCanvas.toDataURL();
      downloadURI(dataURL, 'innerdroste.png');
    },
  });
}
