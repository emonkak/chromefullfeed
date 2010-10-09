(function(){

  var documentFilters = [];
  var filters = [];
  var connection = chrome.extension.connect();
  var Callbacks = {};
  var AP = {};
  var MICROFORMATS = [
    {
        name : 'hAtom-Content',
        xpath: '//*[contains(concat(" ",normalize-space(@class)," "), " hentry ")]//*[contains(concat(" ",normalize-space(@class)," "), " entry-content ")]'
    },
    {
        name : 'hAtom',
        xpath: '//*[contains(concat(" ",normalize-space(@class)," "), " hentry ")]'
    },
    {
        name : 'xFolk',
        xpath: '//*[contains(concat(" ",@class," "), " xfolkentry ")]//*[contains(concat(" ",normalize-space(@class)," "), " description ")]'
    },
    {
        name : 'AutoPagerize(Microformats)',
        xpath: '//*[contains(concat(" ",normalize-space(@class)," "), " autopagerize_page_element ")]'
    },
  ]
  window.FullFeed = {};
  window.FullFeed.filters = filters;
  window.FullFeed.documentFilter = documentFilters;

  // register
  // future => executeScript
  var script = document.createElement('script');
  script.type = "text/javascript";
  script.charset = "utf-8";
  script.src = chrome.extension.getURL('ldr_page_script.js');
  document.head.appendChild(script);

  window.addEventListener('LDRFullFeed.load', function(ev){
    fullfeed(JSON.parse(ev.data), ev.target);
  }, false);
  window.addEventListener('LDRFullFeed.reset', function(){
    connection.postMessage({
      type : 'update'
    });
  }, false);
  window.addEventListener('LDRFullFeed.autopager', function(ev){
    autopager(JSON.parse(ev.data), ev.target);
  }, false);

  connection.onMessage.addListener(function(res){
    if(res.type === "fullfeed"){
      var callback_id = "fullfeed"+res.info.id;
      var requester = Callbacks[callback_id];
      if(requester){
        delete Callbacks[callback_id];
        requester(res.info);
      }
    } else if(res.type === 'autopager'){
      var callback_id = "autopager"+res.info.id;
      var callbacks = Callbacks[callback_id];
      if(callbacks){
        delete Callbacks[callback_id];
        callbacks[(res.info.status)? "load" : "error"](res.info);
      }
    } else if(res.type === 'request'){
      var callback_id = "request"+res.info.id;
      var callbacks = Callbacks[callback_id];
      if(callbacks){
        delete Callbacks[callback_id];
        callbacks[(res.info.status)? "load" : "error"](res.info);
      }
    } else if(res.type === 'update'){
      message(res.info);
    } else if(res.type === 'pattern'){
      regset(res.info);
    }
  });

  // function regset
  var regset = function(info){
    location.href = "javascript:void (function(){ if(!window.LDRFullFeed) LDRFullFeed = {}; LDRFullFeed.SUB = "+
    JSON.stringify({
      "PATTERN" : info.pattern,
      "ICON"    : chrome.extension.getURL('orange.gif')
    })+";})()";
  }

  var regget = function(){
    connection.postMessage({
      type : "pattern"
    });
  }
  regget();

  // function autopager
  var autopager = function(obj, container){
    var id = obj.id;
    var item = AP["autopager"+id];
    delete AP["autopager"+id];
    if(!item) return message('This entry has been already loaded.');
    var page = item.page;
    // ready
    message('Loading AutoPager ...');
    removeClass(container, 'chrome_fullfeed_loaded');
    addClass(container, 'chrome_fullfeed_loading');
    Callbacks["autopager"+id] = {
      load : load,
      error : function(e){ error(e.message)}
    }
    connection.postMessage({
      type : 'autopager',
      info : {
        id  : id,
        url : item.link,
        enc : item.ff.enc
      }
    });
    function load(res){
      var ap = item.ap;
      var ff = item.ff;
      var item_body = $X('id("item_body_' + id + '")/div[@class="body"]', document)[0];
      var text = res.responseText;
      try {
        var htmldoc = parse(text, item.link);
      } catch(e) {
        return error('HTML Parse Error');
      }
      documentFilters.forEach(function(f){ f(htmldoc, item.link, ff) });
      var entry = [];
      var nextLink = null;
      try {
        entry = $X(ff.xpath, htmldoc);
        (!entry.length) && (entry = $X(ap.pageElement, htmldoc));
        nextLink = $X(ap.nextLink, htmldoc);
      } catch(e) {
        error(e);
      }
      if(entry.length){
        filters.forEach(function(f) { f(entry, item.link) });
        // remove entry
        var df = $CF('<hr/><p class="gm_fullfeed_pager">page <a class="gm_fullfeed_link" href="'+item.link+'">'+(++page)+'</a></p>');
        var i = 0;
        var len = entry.length;
        var timer = setTimeout(function callback() {
          clearTimeout(timer);
          df.appendChild($CF(sanitize(entry[i++])));
          if (i < len) {
            timer = setTimeout(callback, 0);
          } else {
            item_body.appendChild(df);
            message('Loading AutoPager ...Done');
            addClass(container, 'chrome_fullfeed_loaded');
            removeClass(container, 'chrome_fullfeed_loading');
            addClass(container, item.link);

            // next autopager
            if(nextLink.length){
              nextLink = nextLink[0];
              nextLink = nextLink.getAttribute('href') ||
                        nextLink.getAttribute('action') ||
                        nextLink.getAttribute('value');
              AP["autopager"+id] = {
                ap   : ap,
                ff   : ff,
                link : nextLink,
                enc  : ff.enc,
                page : page
              }
            }
          }
        }, 0);
      } else {
        return error('This SITE_INFO is unmatched to this entry');
      }
    }
    function error(e){
      message('Error: ' + e);
      addClass(container, 'chrome_fullfeed_error');
      removeClass(container, 'chrome_fullfeed_loading');
    }
  }

  // function fullfeed
  var fullfeed = (function(){
    return function(c, container){
      // registration 1
      Callbacks["fullfeed"+c.id] = requester;
      connection.postMessage({
        type : 'fullfeed',
        info : c
      });
      function requester(item){
        if(!item.siteinfo) return message('This entry is not listed on SITEINFO');
        var info = item.siteinfo.info;
        var aplist = item.siteinfo.ap;
        var requestURL = c.itemURL;
        var item_body = $X('id("item_body_' + c.id + '")/div[@class="body"]', document)[0];
        var entry = [];

        // ready
        message('Loading FullFeed ...');
        removeClass(container, 'chrome_fullfeed_loaded');
        addClass(container, 'chrome_fullfeed_loading');
        // registration 2
        Callbacks["request"+c.id] = {
          "load" : load,
          "error" : function(e){ error(e.message) }
        }
        connection.postMessage({
          type : 'request',
          info : {
            id  : c.id,
            url : c.itemURL,
            enc : info.enc
          }
        });
        // load func
        function load(res){
          var text = res.responseText;
          try {
            // XSS
            var htmldoc = parse(text, requestURL);
          } catch(e) {
            return error('HTML Parse Error');
          }
          // fullfeed
          if(info.microformats) entry = getElementsByMicroformats(htmldoc);
          if(!entry.length){
            try{
              entry = $X(info.xpath, htmldoc);
            } catch(e) {
              return error('Something is wrong with this XPath');
            }
          }
          if(!entry.length){
            aplist.some(function(i){
              if(i.name=='hAtom' || i.name=='autopagerize_microformat') return false;
              try {
                entry = $X(i.pageElement, htmldoc);
              } catch(e) { return false }
              if(entry.length){
                return true;
              }
              else return false;
            });
          }
          if(entry.length){
            filters.forEach(function(f){ f(entry, requestURL) });
            // remove entry
            $D(item_body);
            var df = document.createDocumentFragment();
            var i = 0;
            var len = entry.length;
            var id = setTimeout(function callback() {
              clearTimeout(id);
              df.appendChild($CF(sanitize(entry[i++])));
              if (i < len) {
                id = setTimeout(callback, 0);
              } else {
                item_body.appendChild(df);
                message('Loading FullFeed ...Done');
                addClass(container, 'chrome_fullfeed_loaded');
                removeClass(container, 'chrome_fullfeed_loading');
                addClass(container, requestURL);
                // search AP data
                if(aplist.length){
                  var nextLink;
                  aplist.some(function(i){
                    if((nextLink = $X(i.nextLink, htmldoc)[0]) && ($X(i.pageElement, htmldoc).length)){
                      nextLink = nextLink.getAttribute('href') ||
                                nextLink.getAttribute('action') ||
                                nextLink.getAttribute('value');
                      AP["autopager"+c.id] = {
                        ap   : i,
                        ff   : info,
                        link : nextLink,
                        enc  : c.enc,
                        page : 1
                      }
                      return true;
                    }
                    return false;
                  },this)
                }
              }
            }, 0);
          } else {
            return error('This SITE_INFO is unmatched to this entry');
          }
        }
        function error(e){
          message('Error: ' + e);
          addClass(container, 'chrome_fullfeed_error');
          removeClass(container, 'chrome_fullfeed_loading');
        }
      }
    }
  })();

  // utilities
  var $ = (function(){
    var hash = {};
    return function(id){
      return hash[id] || document.getElementById(id);
    }
  })();
  var $D = function(elm){
    var range = document.createRange();
    range.selectNodeContents(elm);
    range.deleteContents();
    range.detach();
  }
  var $CF = (function(){
    var range = document.createRange();
    range.selectNodeContents(document.body);
    return function(str){
      return range.createContextualFragment(str);
    }
  })();
  function $A(arr){
    return Array.prototype.slice.call(arr);
  }
  // XPath 式中の接頭辞のない名前テストに接頭辞 prefix を追加する
  // e.g. '//body[@class = "foo"]/p' -> '//prefix:body[@class = "foo"]/prefix:p'
  // http://nanto.asablo.jp/blog/2008/12/11/4003371
  function addDefaultPrefix(xpath, prefix) {
    var tokenPattern = /([A-Za-z_\u00c0-\ufffd][\w\-.\u00b7-\ufffd]*|\*)\s*(::?|\()?|(".*?"|'.*?'|\d+(?:\.\d*)?|\.(?:\.|\d+)?|[\)\]])|(\/\/?|!=|[<>]=?|[\(\[|,=+-])|([@$])/g;
    var TERM = 1, OPERATOR = 2, MODIFIER = 3;
    var tokenType = OPERATOR;
    prefix += ':';
    function replacer(token, identifier, suffix, term, operator, modifier) {
      if (suffix) {
        tokenType =
          (suffix == ':' || (suffix == '::' && (identifier == 'attribute' || identifier == 'namespace')))
          ? MODIFIER : OPERATOR;
      } else if (identifier) {
        if (tokenType == OPERATOR && identifier != '*')
          token = prefix + token;
        tokenType = (tokenType == TERM) ? OPERATOR : TERM;
      } else {
        tokenType = term ? TERM : operator ? OPERATOR : MODIFIER;
      }
      return token;
    }
    return xpath.replace(tokenPattern, replacer);
  }

  // $X on XHTML
  // $X(exp);
  // $X(exp, context);
  // @target Freifox3, Chrome3, Safari4, Opera10
  // @source http://gist.github.com/184276.txt
  function $X (exp, context) {
    context || (context = document);
    var _document  = context.ownerDocument || document,
    documentElement = _document.documentElement;
    var isXHTML = documentElement.tagName !== 'HTML' && _document.createElement('p').tagName === 'p';
    var defaultPrefix = null;
    if (isXHTML) {
      defaultPrefix = '__default__';
      exp = addDefaultPrefix(exp, defaultPrefix);
    }
    function resolver (prefix) {
      return context.lookupNamespaceURI(prefix === defaultPrefix ? null : prefix) ||
           documentElement.namespaceURI || '';
    }

    var result = _document.evaluate(exp, context, resolver, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
      switch (result.resultType) {
        case XPathResult.STRING_TYPE : return result.stringValue;
        case XPathResult.NUMBER_TYPE : return result.numberValue;
        case XPathResult.BOOLEAN_TYPE: return result.booleanValue;
        case XPathResult.ORDERED_NODE_ITERATOR_TYPE:
          var ret = [], i = null;
          while (i = result.iterateNext()) ret.push(i);
          return ret;
      }
    return null;
  }
  var message = function(str){
    $("message").innerHTML = str;
  }
  var hasClass = function(e, name){
    name = name.toLowerCase();
    var cn = e.className;
    if (!cn) return false;
    var cnlist = cn.toLowerCase().split(/\s+/);
    for (var i=0,l=cnlist.length;i<l;i++)
      if(cnlist[i] == name) return true;
    return false;
  }
  var addClass = function(e, name){
    var cn = e.className || '';
    if(hasClass(e, name)) return;
    e.className = cn+' '+name;
  }
  var removeClass = function(e, name){
    if(!hasClass(e, name)) return;
    var cn = e.className || '';
    name = name.toLowerCase();
    var cnlist = cn.toLowerCase().split(/\s+/);
    cnlist.splice(cnlist.indexOf(name), 1);
    e.className = cnlist.join(' ');
  }
  var toggleClass = function(e, name){
    (hasClass(e, name))? removeClass(e, name) : addClass(e, name);
  }
  var filter = function(a, f) {
    for (var i = a.length; i --> 0; f(a[i]) || a.splice(i, 1));
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
  function remove_risks(htmldoc){
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
  function parse(str, link) {
    try {
      // thanks id:os0x
      var htmldoc = document.implementation.createHTMLDocument('fullfeed');
      var range = document.createRange();
      range.selectNodeContents(htmldoc.body);
      var df = range.createContextualFragment(str);
      htmldoc.body.appendChild(df);
      remove_risks(htmldoc);
      var resolver = path_resolver(link);
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
  // filter registration
  (function(){
    var h2_span = document.createElement('span');
    h2_span.className = 'chrome_fullfeed_h2';
    filters.push(function(nodes, url){
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
    filters.push(function(nodes, url){
      var removeClass = removeClass;
      nodes.forEach(function(e){
        $X('descendant-or-self::*[contains(concat(" ",@class," ")," more ")]', e)
        .forEach(function(i){
          removeClass(i, 'more');
        });
      });
    });
    var reg = /(^http:\/\/d\.hatena\.ne\.jp|^http:\/\/.+?.g\.hatena\.ne\.jp\/bbs|^http:\/\/(.)*?\.g\.hatena.ne\.jp\/|^http:\/\/anond\.hatelabo\.jp\/)/;
    var span = document.createElement('span');
    span.className = 'keyword';
    filters.push(function(nodes, url){
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


// http://d.hatena.ne.jp/os0x/20080228/1204210085
// a little modified
function escapeHTML(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}
function sanitize(node) {
  if (node.nodeType !== 1 && node.nodeType !== 3) {
    return;
  }
  var contents = Array.prototype.slice.call(node.childNodes).reduce(function(memo, node) {
    var content = sanitize(node);
    if (content) {
      memo.push(content);
    }
    return memo;
  }, []);
  if (node.nodeType === 1) {
    // white list
    var tag = node.tagName;
    var attr = (function attrCollector() {
      var res = [''];
      switch (tag.toUpperCase()) {
        case 'H2':
          tag = 'H3';
          break;
        case 'IMG':
          if (/^(?:https?:\/\/|\.|\/)/.test(node.src)) {
            res.push('src=' + JSON.stringify(node.src));
          }
          if (node.alt || node.title) {
            res.push('alt=' + JSON.stringify(node.alt || node.title));
          }
          break;
        case 'A':
          if (/^(?:https?:\/\/|\.|\/)/.test(node.href)) {
            res.push('href='+ JSON.stringify(node.href));
          }
          if (node.alt || node.title) {
            res.push('alt=' + JSON.stringify(node.alt || node.title));
          }
          break;
      };
      return res.join(' ');
    })();
    tag = escapeHTML(tag);
    return '<' + tag + ' ' + attr + '>' + contents.join('') + '</' + tag + '>';
  } else if (node.nodeType === 3) {
    return escapeHTML(node.nodeValue);
  }
}
})();
