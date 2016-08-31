module.exports = {
  debug: debug,
  getRandomProduct: getRandomProduct,
  rewriteHost: rewriteHost,
  preparePurchase: preparePurchase,
  prepareAddCartCall: prepareAddCartCall,
  printCart: printCart,
  printAddToCart: printAddToCart,
  printCookie: printCookie
};

var cheerio = require('cheerio');
var fs = require('fs');
var request = require('request');
var L = require('lodash');
var chalk = require('chalk');

function debug(req, res, ctx, ee, cb) {
  if (res.statusCode !== 200) {
    console.log(res.statusCode);
    console.log(req.uri);
    console.log(res.body);
  }
  return cb(null);
}

//
// Helper function for testing the origin (Apache) directly instead of going
// through Cloudflare
//
function rewriteHost(requestSpec, context, ee, next) {
  // We must set Host to this to avoid being redirected
  requestSpec.headers.host = 'www.yourmagentostore.com';
  // But we want to make requests directly to the Apache instance to go around
  // Clouflare
  requestSpec.uri = requestSpec.uri.replace(/(www\.)?yourmagentostore\.com/, '000.000.000.00');
  // And we need to send the cookie - request won't do it for us because domains won't match
  var cookie = requestSpec.jar.getCookieString('http://yourmagentostore.com/');
  requestSpec.headers.cookie = cookie;
  context._jar = request.jar();
  requestSpec.jar = context._jar;
  return next(null);
}

//
// Function to get a product at random if custom logic is needed
// (otherwise standard capture with css is fine)
//
function getRandomProduct(requestSpec, response, context, ee, next) {
  var $ = cheerio.load(response.body);
  var els = $('a.product.photo.product-item-photo');
  var length = els.get().length;
  //console.log('have %s products on page', length);

  if (length > 0) {
    var i = Math.ceil(Math.random() * length - 1);
    var url = els.slice(i - 1, i).attr('href');
    url.replace(/(www\.)?yourmagentostore\.com/, '000.000.000.00');
    context.vars.url = url;
  } else {
    // Could set a fallback URL here
  }
  return next(null);
}

//
// Expects the HTML for a product page in respose.body and creates the
// following context vars:
// - addToCartUrl
// - productId
// - formKey
// - sizeCode
//
// If the product is not of the right type (something with sizes XS, S, M or
// L) or all sizes are out of stock, no variables are created.
function preparePurchase(requestSpec, response, context, ee, next) {
  var $ = cheerio.load(response.body);

  var sizeDataContainer = $('script')
        .toArray()
        .filter(function (e) {
          return /SwatchRenderer\(/.test($(e).html());
        })[0];

  if (!sizeDataContainer) {
    // Nothing to be done here:
    return next();
  }

  var s = $(sizeDataContainer).html();

  var data = null;
  try {
    data = JSON.parse(s.substring(s.indexOf('jsonConfig:'), s.indexOf('jsonSwatchConfig')).match(/(jsonConfig\:)(.*}}}),/)[2]);
  } catch (err) {
  }

  if (!data) {
    return next();
  }

  // Grab one thing at random from data.index:

  var el = $('form#product_addtocart_form');
  var addToCartUrl = el.attr('action');
  addToCartUrl = addToCartUrl.replace('http://', 'https://');

  var formKeyEl = $('input[name="form_key"]');
  var formKey;
  if (formKeyEl.length > 1) {
    formKey = formKeyEl.slice(0, 1).attr('value');
  } else if (formKeyEl.length === 1) {
    formKey = $(formKeyEl).attr('value');
  } else {
    throw new Error('panic');
  }

  var indexKeys = Object.keys(data.index);
  var productId = L.sample(indexKeys);
  var formData = {
    product: productId,
    selected_configurable_option: '',
    related_product: '',
    form_key: formKey,
    'super_attribute[157]': data.index[productId][157]
  };

  context.vars.formData = formData;
  context.vars.addToCartUrl = addToCartUrl;

  //console.log('***** preparePurchase');
  //console.log('addToCartUrl', addToCartUrl);

  // data is something like:
  // {
  //   "attributes": {
  //     "157": {
  //       "id": "157",
  //       "code": "c2c_size",
  //       "label": "Size",
  //       "options": [
  //         {
  //           "id": "35",
  //           "label": "36",
  //           "products": [
  //             "943"
  //           ]
  //         },
  //         {
  //           "id": "36",
  //           "label": "37",
  //           "products": [
  //             "944"
  //           ]
  //         },
  //         {
  //           "id": "37",
  //           "label": "38",
  //           "products": []
  //         },
  //         {
  //           "id": "38",
  //           "label": "39",
  //           "products": []
  //         },
  //         {
  //           "id": "39",
  //           "label": "40",
  //           "products": [
  //             "947"
  //           ]
  //         },
  //         {
  //           "id": "40",
  //           "label": "41",
  //           "products": []
  //         }
  //       ]
  //     }
  //   },
  //   "template": "$<%- data.price %>",
  //   "optionPrices": {
  //     "943": {
  //       "oldPrice": {
  //         "amount": "299"
  //       },
  //       "basePrice": {
  //         "amount": "299"
  //       },
  //       "finalPrice": {
  //         "amount": "299"
  //       }
  //     },
  //     "944": {
  //       "oldPrice": {
  //         "amount": "299"
  //       },
  //       "basePrice": {
  //         "amount": "299"
  //       },
  //       "finalPrice": {
  //         "amount": "299"
  //       }
  //     },
  //     "947": {
  //       "oldPrice": {
  //         "amount": "299"
  //       },
  //       "basePrice": {
  //         "amount": "299"
  //       },
  //       "finalPrice": {
  //         "amount": "299"
  //       }
  //     }
  //   },
  //   "prices": {
  //     "oldPrice": {
  //       "amount": "299"
  //     },
  //     "basePrice": {
  //       "amount": "299"
  //     },
  //     "finalPrice": {
  //       "amount": "299"
  //     }
  //   },
  //   "productId": "942",
  //   "chooseText": "Choose an Option...",
  //   "images": [],
  //   "index": {
  //     "943": {
  //       "157": "35"
  //     },
  //     "944": {
  //       "157": "36"
  //     },
  //     "947": {
  //       "157": "39"
  //     }
  //   }
  // }

  return next();
};

// TODO: Rename, does more than the name suggests.

function prepareAddCartCall(req, context, ee, next) {
  var formData = context.vars.formData;
  var addToCartUrl = context.vars.addToCartUrl;

  req.headers['Origin'] = 'http://www.yourmagentostore.com';
  req.headers['X-Requested-With'] = 'XMLHttpRequest';

  req.form = context.vars.formData;
  req.json = true;

  if (req.form) {
    //req.jar.setCookie('form_key=' + req.form.form_key,
    //                  'http://www.yourmagentostore.com/');
    req.headers['cookie'] += '; form_key=' + req.form.form_key;
  }

  return next();
};

function printCart(req, res, context, ee, next) {
  var $ = cheerio.load(res.body);
  var els = $('span.price');

  //console.log('span.price length: %s', els.length);

  var total = 0;
  els.toArray().forEach(function (e) {
    var itemPrice = Number($(e).html().split('$')[1]);
    if (itemPrice > 0) {
      total += itemPrice;
    }
  });

  console.log('Total cart value: ', chalk.green(total));
  return next();
}

function printAddToCart(req, res, context, ee, next) {
  if (res.statusCode !== 200) {
    console.log(chalk.yellow('add to cart status is not 200: '),
                res.statusCode);
    console.log(res.headers);
  }
  return next();
}

function printCookie(req, res, context, ee, next) {
  console.log(chalk.yellow(req.uri));
  console.log(chalk.green(JSON.stringify(res.headers['set-cookie'])));
  return next();
}
