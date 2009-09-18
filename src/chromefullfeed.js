
contentWindow.addEventListener('load', function(){
var w = this.contentWindow || this;
var KEY = 'g';
var GET_SITEINFO_KEY = 'G';
var GET_ALL_KEY = 'u';
var VERSION = '0.0.1';

var ADCHECKER = /(^AD:|^PR:)/;
var MICROFORMATS = [
  {
      name : 'hAtom-Content',
      xpath: '//*[contains(concat(" ",normalize-space(@class)," "), " hentry ")]//*[contains(concat(" ",normalize-space(@class)," "), " entry-content ")]',
  },
  {
      name : 'hAtom',
      xpath: '//*[contains(concat(" ",normalize-space(@class)," "), " hentry ")]',
  },
  {
      name : 'xFolk',
      xpath: '//*[contains(concat(" ",@class," "), " xfolkentry ")]//*[contains(concat(" ",normalize-space(@class)," "), " description ")]',
  },
  {
      name : 'AutoPagerize(Microformats)',
      xpath: '//*[contains(concat(" ",normalize-space(@class)," "), " autopagerize_page_element ")]',
  },
];

var AUTOPAGERIZE_MICROFORMAT = {
  name:         'autopagerize_microformat',
  url:          '.*',
  reg:          /.+/,
  nextLink:     '//a[@rel="next"] | //link[@rel="next"]',
  insertBefore: '//*[contains(@class, "autopagerize_insert_before")]',
  pageElement:  '//*[contains(@class, "autopagerize_page_element")]',
};

var FullFeed = function(item){
  this.data = item;
  this.container = w.$(item.containerId)
  this.type = 'FullFeed';
  this.requestURL = this.data.itemURL;
  var bodyXPath = 'id("item_body_' + this.data.id + '")/div[@class="body"]';
  this.item_body = $X(bodyXPath, document)[0];
  this.entry = [];
};

FullFeed.prototype.ready = function(){
  message('Loading '+this.type+' ...');
  if(w.hasClass(this.container, 'chrome_fullfeed_loaded'))
    w.toggleClass(this.container, 'chrome_fullfeed_loaded');
  w.toggleClass(this.container, 'chrome_fullfeed_loading');
}

FullFeed.prototype.load = function(res){
  this.info = res.info;
  this.state = 'loading';
  var text = res.responseText;
  var self = this;

  try {
    text = text.replace(/(<[^>]+?[\s"'])on(?:(?:un)?load|(?:dbl)?click|mouse(?:down|up|over|move|out)|key(?:press|down|up)|focus|blur|submit|reset|select|change)\s*=\s*(?:"(?:\\"|[^"])*"?|'(\\'|[^'])*'?|[^\s>]+(?=[\s>]|<\w))(?=[^>]*?>|<\w|\s*$)/gi, "$1");
    text = text.replace(/<iframe(?:\s[^>]+?)?>[\S\s]*?<\/iframe\s*>/gi, "");
    var htmldoc = parse(text, this.data, res);
  } catch(e) {
    return this.error('HTML Parse Error');
  }

  FullFeed.documentFilters.forEach(function(f) {
    f(htmldoc, this.requestURL, this.info);
  },this);
  this['get'+this.type](htmldoc);
}

FullFeed.prototype.getFullFeed = function(htmldoc){
  this.entry = [];
  if(this.info.microformats){
    this.entry = getElementsByMicroformats(htmldoc)
  }

  if(this.entry.length == 0){
    try{
      this.entry = $X(this.info.xpath, htmldoc);
    } catch(e) {
      return this.error('Something is wrong with this XPath');
    }
  }
  this.requestEnd(htmldoc);
}
FullFeed.prototype.requestEnd = function(htmldoc){
  if (this.entry.length > 0) {
    FullFeed.filters.forEach(function(f) { f(this.entry, this.requestURL) }, this);
    this.addEntry();
    this.state = 'loaded';
    message('Loading '+this.type+' ...Done');
    w.addClass(this.container, 'chrome_fullfeed_loaded');
    w.toggleClass(this.container, 'chrome_fullfeed_loading');
    w.toggleClass(this.container, this.requestURL);
  }
  else return this.error('This SITE_INFO is unmatched to this entry');
}

FullFeed.prototype.error = function(e){
  this.state = 'error';
  message('Error: ' + e);
  w.addClass(this.container, 'chrome_fullfeed_error');
  w.toggleClass(this.container, 'chrome_fullfeed_loading');
}

FullFeed.prototype.createSpaceFullFeed = function(){
  var range = document.createRange();
  range.selectNodeContents(this.item_body);
  range.deleteContents();
  range.detach();
  return document.createDocumentFragment();
}

FullFeed.prototype.addEntry = function(){
  var df = this['createSpace'+this.type]();
  this.entry.forEach(function(i){
    try {
      i = document.adoptNode(i, true);
    }catch(e){
      i = document.importNode(i, true);
    }
    df.appendChild(i);
  });
  this.item_body.appendChild(df);
}

FullFeed.register = function(){
  var callback_name = 'C_B_'+String((Math.random() * Math.random()).toString(36)).slice(2);
  var icon_path = chrome.extension.getURL('orange.gif');
  var description = "\u5168\u6587\u53d6\u5f97\u3067\u304d\u308b\u3088\uff01";
  w.entry_widgets.add('chrome_fullfeed_widget', function(feed, item){
    var pattern = Manager.pattern;
    if(pattern && (pattern.test(item.link) || pattern.test(feed.channel.link)) && !ADCHECKER.test(item.title)) {
      return [
        '<img class="chrome_fullfeed_icon" id="chrome_fullfeed_widget_'+item.id+'" src="'+icon_path+'" onclick="'+callback_name+'(\''+item.id+'\')">'
      ].join('');
    }
  }, description);

  w[callback_name] = function(id){
    Manager.check(id);
  }
}

FullFeed.documentFilters = [];

FullFeed.filters= [];

window.FullFeed = {
  VERSION: VERSION,
  addFilter: function(f){ FullFeed.filters.push(f) },
  addDocumentFilter: function(f){ FullFeed.documentFilters.push(f) },
};

window.FullFeed.addFilter(function(nodes, url){
    nodes.forEach(function(e){
      var anchors = $X('descendant-or-self::a', e);
      anchors && anchors.forEach(function(i){ i.target = '_blank' });
    });
});

(function(){
  (function(){
    var h2_span = document.createElement('span');
    h2_span.className = 'chrome_fullfeed_h2';
    window.FullFeed.addFilter(function(nodes, url){
      filter(nodes, function(e){
        var n = e.nodeName;
        if(n.indexOf('SCRIPT') == 0) return false;
        if(n.indexOf('H2') == 0) return false;
        return true;
      });
      nodes.forEach(function(e){
        $X('descendant-or-self::*[self::script or self::h2]', e)
        .forEach(function(i){
          var n = i.nodeName;
          var r = h2_span.cloneNode(false);
          if(n == 'SCRIPT') i.parentNode.removeChild(i);
          if(n == 'H2'){
            $A(i.childNodes).forEach(function(child){ r.appendChild(child.cloneNode(true)) });
            i.parentNode.replaceChild(r, i);
          }
        });
      });
    });
  })();
  (function(){
    window.FullFeed.addFilter(function(nodes, url){
      var removeClass = w.removeClass;
      nodes.forEach(function(e){
        $X('descendant-or-self::*[contains(concat(" ",@class," ")," more ")]', e)
        .forEach(function(i){
          removeClass(i, 'more');
        });
      });
    });
  })();
  (function(){
    var reg = /(^http:\/\/d\.hatena\.ne\.jp|^http:\/\/.+?.g\.hatena\.ne\.jp\/bbs|^http:\/\/(.)*?\.g\.hatena.ne\.jp\/|^http:\/\/anond\.hatelabo\.jp\/)/;
    var span = document.createElement('span');
    span.className = 'keyword';
    window.FullFeed.addFilter(function(nodes, url){
      if(!reg.test(url)) return;
      nodes.forEach(function(e){
        var keywords = $X('descendant-or-self::a[(@class="keyword") or (@class="okeyword")]', e);
        if(keywords){
          keywords.forEach(function(key){
            var r = span.cloneNode(false);
            $A(key.childNodes).forEach(function(child){ r.appendChild(child.cloneNode(true)) });
            key.parentNode.replaceChild(r, key);
          });
        }
      });
    });
  })();
})();

// key value storeとしてのDB利用
var DB = function(){
  this.factory = google.gears.factory;
  var db = this.db = this.factory.create('beta.database');
  this.insert_statement = 'insert into LDR values (?, ?)';
  this.update_statement = 'update LDR set value = ? where ( key = ? )';
  this.create_table_statement = 'create table if not exists LDR ( key text, value text )';
  this.select_statement = 'select * from LDR';
  this.delete_statement = 'delete from LDR where ( key = ? )';
  this.delete_all_statement = 'delete from LDR';
}
DB.prototype = {
  // like ruby iterator block
  block : function(func, self){
    self || (self = this);
    var res = null;
    this.db.open('LDRFULLFEED');
    try {
      res = func.call(self, this.db);
    } finally {
      this.db.close();
    }
    return res;
  },

  create_table : function(){
    return this.block(function(db){
      return this.treat_result(db.execute(this.create_table_statement));
    }, this);
  },

  insert : function(key, val){
    return this.block(function(db){
      var res = this.treat_result(db.execute(this.insert_statement, [key, val]));
      return res;
    }, this);
  },

  del : function(key){
    return this.block(function(db){
      db.execute(this.delete_statement, [key]);
    }, this);
  },

  delAll: function(){
    return this.block(function(db){
      db.execute(this.delete_all_statement);
    }, this);
  },

  select : function(){
    return this.block(function(db){
      return this.treat_result(db.execute(this.select_statement));
    }, this);
  },

  update : function(key, val){
    return this.block(function(db){
      return this.treat_result(db.execute(this.update_statement, [val, key]));
    }, this);
  },

  treat_result : function(res){
    if(!res.isValidRow()) return {};
    var result = {};
    while(res.isValidRow()){
      var temp = {};
      for(var i = 0, len = res.fieldCount(); i < len; ++i){
        temp[res.fieldName(i)] = res.field(i);
      }
      result[temp.key] = temp.value
      res.next();
    }
    res.close();
    return result;
  },
}

var Manager = {
  info: null,
  pattern: null,
  state: 'normal',
  init: function(){
    var self = this;
    if(typeof(this.db) === 'undefined'){
      this.db = new DB();
      this.db.create_table();
    }
    var store = this.db.select();
    this.checkSiteinfoExist(function(info){
      if(store['siteinfo'] && store['date']){
        if(info.date < store['date']){
          self.sendSiteinfo(store['siteinfo'], store['date'], function(){
            self.start();
          }, function(){
            message('Siteinfo trouble');
          });
        } else if(info.date == store['date']){
          self.start();
        } else {
          self.db.update('siteinfo', info.siteinfo);
          self.db.update('date', info.date);
          self.start();
        }
      } else {
        self.db.insert('siteinfo', info.siteinfo);
        self.db.insert('date', info.date);
        self.start();
      }
    }, function(info){
      if(info.type === 'PleaseSend'){
        if(store['siteinfo'] && store['date']){
          self.sendSiteinfo(store['siteinfo'], store['date'], function(){
            self.start();
          }, function(){
            message('Siteinfo trouble');
          });
        } else {
          self.updating = true;
          self.update(function(info){
            self.updating = false;
            self.db.insert('siteinfo', info.siteinfo);
            self.db.insert('date', info.date);
            self.init();
          }, function(info){
            self.updating = false;
            message(info.message);
          });
        }
      }
    });
  },
  start : function(){
    var self = this;
    self.getPattern(function(item){
      self.pattern = new RegExp(item.pattern);
      var id = setTimeout(function(){
        if (id) clearTimeout(id);
        if (typeof w.Keybind != 'undefined' && typeof w.entry_widgets != 'undefined') {
          w.Keybind.add(KEY, function(){
            self.loadCurrentEntry();
          });

          w.Keybind.add(GET_ALL_KEY, function(){
            self.loadAllEntries();
          });

          w.Keybind.add(GET_SITEINFO_KEY, function() {
            self.resetSiteinfo();
          });

          FullFeed.register();
        } else {
          id = setTimeout(arguments.callee, 100);
        }
      }, 0);
    }, function(item){
      message('Siteinfo trouble');
    });
  },
  loadCurrentEntry: function(){
    this.check();
  },
  loadAllEntries: function(){
    var items = w.get_active_feed().items;
    if (items && items.length > 0)
    items.forEach(function(item){ this.check(item.id) }, this);
  },
  resetSiteinfo : function(){
    if(this.updating) return message('Now loading. Please wait!');
    var self = this;
    this.updating = true;
    message('Resetting cache. Please wait...');
    self.update(function(info){
      self.db.update('siteinfo', info.siteinfo);
      self.db.update('date', info.date);
      message('Resetting cache. Please wait...Done');
      self.updating = false;
    }, function(info){
      message(info.message);
      self.updating = false;
    });
  },
  check: function(id){
    var c = (id) ? this.getData(id) : this.getData();
    if(!c) return;
    if(ADCHECKER.test(c.title))
      return message('This entry is advertisement');
    if(w.hasClass(w.$(c.containerId), 'chrome_fullfeed_loaded')){
      return message('This entry has been already loaded.');
    }
    if(w.hasClass(w.$(c.containerId), 'chrome_fullfeed_loading'))
      return message('Now loadig...');

    var ff = new FullFeed(c);
    this.launchFullFeed(c,
    function(){
      ff.ready();
    },
    function(item){
      ff.load(item);
    },
    function(item){
      ff.error('load error');
      message(item.message);
    });
  },
  getData: function(id){
    if(!id) var id = w.get_active_item(true).id;
    if(!id) return;
    var obj = {}
    var feed = w.get_active_feed();

    obj.id = id;
    obj.itemURL = w.get_item_info(id).link;
    obj.feedURL = feed.channel.link;
    obj.containerId = 'item_' + obj.id;
    return obj;
    //obj.title = this.item.title;
    //obj.found = false;
  }
}
Manager.set = function(){
  var stock = {};
  var connect_count = 0;
  var con = chrome.extension.connect();
  var listeners = {};
  con.onMessage.addListener(function(item){
    if(listeners[item.connect_id]){
      listeners[item.connect_id](item);
      listeners[item.connect_id] = null;
    }
    console.info(item);
    if(!item.hide){
      if(item.ok){
        if(stock[item.connect_id]){
          stock[item.connect_id].success(item);
          stock[item.connect_id] = null;
        }
      } else {
        if(stock[item.connect_id]){
          stock[item.connect_id].failure(item);
          stock[item.connect_id] = null;
        }
      }
    }
  });
  function listener(id, func){
    listeners[id] = func;
  }
  Manager.launchFullFeed = function(item, ready, success, failure){
    connect_count += 1;
    item.connect_id = 'callback' + connect_count;
    listener(item.connect_id, ready);
    stock[item.connect_id] = {
      success: success,
      failure: failure
    }
    item.type = 'FullFeed';
    con.postMessage(item);
  }
  Manager.checkSiteinfoExist = function(success, failure){
    connect_count += 1;
    var item = {
      type : 'Check',
      connect_id : 'callback' + connect_count
    };
    stock[item.connect_id] = {
      success: success,
      failure: failure
    }
    con.postMessage(item);
  }
  Manager.getPattern = function(success, failure){
    connect_count += 1;
    var item = {
      type : 'Pattern',
      connect_id : 'callback' + connect_count
    };
    stock[item.connect_id] = {
      success: success,
      failure: failure
    }
    con.postMessage(item);
  }
  Manager.sendSiteinfo = function(siteinfo_text, date, success, failure){
    connect_count += 1;
    var item = {
      type : 'SendSiteinfo',
      siteinfo : siteinfo_text,
      date : date,
      connect_id : 'callback' + connect_count
    }
    stock[item.connect_id] = {
      success: success,
      failure: failure
    }
    con.postMessage(item);
  }
  Manager.update = function(success, failure){
    connect_count += 1;
    var item = {
      type : 'Update',
      connect_id : 'callback' + connect_count
    }
    stock[item.connect_id] = {
      success: success,
      failure: failure
    }
    con.postMessage(item);
  }
}
// main
Manager.set();
Manager.init();


// == [Utility Functions] ===========================================

function message (mes){
  w.message(mes);
}

function $A(a){
  return Array.prototype.slice.call(a);
}

function getElementsByMicroformats (htmldoc) {
  var t;
  MICROFORMATS.some(function(i){
    t = $X(i.xpath, htmldoc)
    if(t.length>0){
      return true;
    }
    else return false;
  });
  return t;
}

// simple version of $X
// $X(exp);
// $X(exp, context);
// @source http://gist.github.com/3242.txt
// @author id:os0x
function $X (exp, context) {
	context || (context = document);
	var expr = (context.ownerDocument || context).createExpression(exp, function (prefix) {
		return document.createNSResolver(context.documentElement || context).lookupNamespaceURI(prefix) ||
			context.namespaceURI || document.documentElement.namespaceURI || "";
	});

	var result = expr.evaluate(context, XPathResult.ANY_TYPE, null);
		switch (result.resultType) {
			case XPathResult.STRING_TYPE : return result.stringValue;
			case XPathResult.NUMBER_TYPE : return result.numberValue;
			case XPathResult.BOOLEAN_TYPE: return result.booleanValue;
			case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
				// not ensure the order.
				var ret = [], i = null;
				while (i = result.iterateNext()) ret.push(i);
				return ret;
		}
	return null;
}

function rel2abs(resolver, htmldoc){
  $X("descendant-or-self::a[@href]", htmldoc)
    .forEach(function(elm) {
    elm.setAttribute("href", resolver(elm.getAttribute("href")));
  });
  $X("descendant-or-self::*[self::img[@src] or self::embed[@src]]", htmldoc)
    .forEach(function(elm) {
    elm.setAttribute("src", resolver(elm.getAttribute("src")));
  });
  $X("descendant-or-self::object[@data]", htmldoc)
    .forEach(function(elm) {
    elm.setAttribute("data", resolver(elm.getAttribute("data")));
  });
}

var remove_risks = function(htmldoc){
  var attr = "allowscriptaccess";
  $X("descendant-or-self::embed[@allowscriptaccess]", htmldoc)
    .forEach(function(elm){
    elm.setAttribute(attr, "never");
  });
  $X("descendant-or-self::param", htmldoc)
    .forEach(function(elm){
    if(!elm.getAttribute("name") || elm.getAttribute("name").toLowerCase().indexOf(attr) < 0) return;
    elm.setAttribute("value", "never");
  });
}

function filter(a, f) {
	for (var i = a.length; i --> 0; f(a[i]) || a.splice(i, 1));
}

function parse(str, item, res) {
  try {
    var htmldoc = document.implementation.createHTMLDocument('fullfeed');
    var df = $CF(str);
    nl = df.childNodes;
    htmldoc.body.appendChild(df);
    remove_risks(htmldoc);
    var resolver = path_resolver(item.itemURL);
    rel2abs(resolver, htmldoc);
    return htmldoc;
  } catch(e) {
    console.info(e);
    throw 'Parse Error';
  }
}

function path_resolver(base) {
  var top = base.match(/^https?:\/\/[^\/]+/)[0];
  var current = base.replace(/\/[^\/]+$/, '/');
  return function(url){
    if (url.match(/^https?:\/\//)) {
      return url;
    } else if (url.indexOf("/") === 0) {
      return top + url;
    } else {
      var result = current;
      if(url.indexOf(".") === 0){
        var count = 15;// 無限ループ防止用. 15回も../や./使ってるURLはさすがにないだろということで.
        while(url.indexOf(".") === 0 && !(--count === 0)){
          if(url.substring(0, 3) === "../")
            result = result.replace(/\/[^\/]+\/$/,"/");
          url = url.replace(/^\.+\/?/,"")
        }
      }
      return result + url;
    }
  }
}

var $CF = (function(){
  var range = document.createRange();
  range.selectNodeContents(document.body);
  return function(str){
    return range.createContextualFragment(str);
  }
})();

}, false);
