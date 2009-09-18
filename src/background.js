
window.addEventListener('load', function(){
  chrome.self.onConnect.addListener(function(port){
    port.onMessage.addListener(function(item, con){
      var type = item.type;
      if(type === 'fullfeed'){
        fullfeed(con, item);
      } else if(type === 'autopager'){
        autopager(con, item);
      } else if(type === 'request'){
        request(con, item);
      } else if(type === 'pattern'){
        regset(con, item);
      } else if(type === 'update'){
        update(con, item);
      }
    });
  });
}, false);

var VERSION = '1.0.0';
var SITEINFO_IMPORT_URLS = [
{
  name:'Wedata',
  format:'JSON',
  type:'LDRFullFeed',
  url: 'http://wedata.net/databases/LDRFullFeed/items.json',
},
{
  name:'Wedata AutoPagerize',
  format:'JSON',
  type:'AutoPagerize',
  url: 'http://wedata.net/databases/AutoPagerize/items.json',
  alternative: 'http://utatane.appjet.net/databases/AutoPagerize/items.json'
},
];

var AUTOPAGERIZE_MICROFORMAT = {
  name:         'autopagerize_microformat',
  url:          '.*',
  nextLink:     '//a[@rel="next"] | //link[@rel="next"]',
  insertBefore: '//*[contains(@class, "autopagerize_insert_before")]',
  pageElement:  '//*[contains(@class, "autopagerize_page_element")]',
}

var PHASE = [
  {type:'SBM'                            },
  {type:'INDIVIDUAL',         sub:'IND'  },
  {type:'INDIV_MICROFORMATS'             },
  {type:'SUBGENERAL',         sub:'SUB'  },
  {type:'GENERAL',            sub:'GEN'  },
  {type:'MICROFORMATS',       sub:'MIC'  }
];

var SITEINFO = null;
var PATTERN = null;

var ChromeXHR = (function(){
  var XHR_TIMEOUT = 30 * 1000;
  return function(opt){
    var req = new XMLHttpRequest(),
        params = [],
        not_timeout = true;
    opt        || (opt = {});
    opt.method || (opt.method = 'GET');
    opt.data   || (opt.data = {});

    for(var key in opt.data){
      if(opt.data.hasOwnProperty(key))
        params.push(encodeURIComponent(key)+'='+encodeURIComponent(opt.data[key]));
    }
    params = params.join('&');

    req.onreadystatechange = function(e){
      if(req.readyState === 4){
        if (req.status >= 200 && req.status < 300)
          if(not_timeout){
            not_timeout = false;
            opt.onload && opt.onload(req);
          }
        else
          if(not_timeout){
            not_timeout = false;
            opt.onerror && opt.onerror(req);
          }
      }
    }
    req.open(opt.method, opt.url, true);
    if(opt.overrideMimeType && req.overrideMimeType)
      req.overrideMimeType(opt.overrideMimeType);
    if(opt.header){
      for(var key in opt.header){
        if(opt.header.hasOwnProperty(key))
          req.setRequestHeader(key, opt.header[key]);
      }
    }
    if(opt.method.toUpperCase()==='POST')
      req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    req.send(params);
    var id = setTimeout(function(){
      clearTimeout(id);
      if(not_timeout){
        not_timeout = false;
        opt.ontimeout && opt.ontimeout(req);
      }
    }, XHR_TIMEOUT);
    return req;
  }
})();

var fullfeed = function(con, item){
  var item = item.info;
  var item_url = item.itemURL;
  var feed_url = item.feedURL;
  var info = null
  for(var i = 0, len = PHASE.length; i < len; ++i){
    var phase = PHASE[i];
    var fullfeed_list = SITEINFO.ldrfullfeed[phase.type];
    for(var k = 0, list_len = fullfeed_list.length; k < list_len; ++k){
      var data = fullfeed_list[k];
      var reg = new RegExp(data.url);
      if(reg.test(item_url) || reg.test(feed_url)){
        info = data;
        break;
      }
    }
  }
  if(!!info){
    var aulist = SITEINFO.autopagerize.filter(function(i){
      var reg = new RegExp(i.url);
      return reg.test(item_url) || reg.test(feed_url);
    });
    con.postMessage({
      type : "fullfeed",
      info : {
        id       : item.id,
        siteinfo : {
          info: info,
          ap  : aulist
        }
      }
    });
  } else {
    con.postMessage({
      type : "fullfeed",
      info : {
        id       : item.id,
        siteinfo : false
      }
    });
  }
}

var request = function(con, item){
  var info = item.info;
  var opt = {
    method: 'get',
    url: info.url,
    overrideMimeType: 'text/html; charset=' + (info.enc || 'UTF-8'),
    headers: {
      'User-Agent': navigator.userAgent + ' GoogleChrome (LDR Full Feed ' + VERSION + ')',
    },
    onerror: function(){
      con.postMessage({
        type : "request",
        info : {
          status : false,
          message: 'This entry is not listed on SITEINFO'
        }
      });
    },
    onload: function(res){
      con.postMessage({
        type : "request",
        info : {
          id           : info.id,
          status       : true,
          responseText : res.responseText
        }
      });
    },
    ontimeout: function(){
      con.postMessage({
        type : "request",
        info : {
          id     : info.id,
          status : false,
          message: 'request timeout'
        }
      });
    }
  };
  ChromeXHR(opt);
}


var autopager = function(con, item){
  var info = item.info;
  var opt = {
    method: 'get',
    url: info.url,
    overrideMimeType: 'text/html; charset=' + (info.enc || 'UTF-8'),
    headers: {
      'User-Agent': navigator.userAgent + ' GoogleChrome (LDR Full Feed ' + VERSION + ')',
    },
    onerror: function(){
      con.postMessage({
        type : "autopager",
        info : {
          status : false,
          message: 'This entry is not listed on SITEINFO'
        }
      });
    },
    onload: function(res){
      con.postMessage({
        type : "autopager",
        info : {
          id           : info.id,
          status       : true,
          responseText : res.responseText
        }
      });
    },
    ontimeout: function(){
      con.postMessage({
        type : "autopager",
        info : {
          id     : info.id,
          status : false,
          message: 'request timeout'
        }
      });
    }
  };
  ChromeXHR(opt);
}

var regset = function(con){
  con.postMessage({
    type : "pattern",
    info : {
      pattern : PATTERN
    }
  });
}

var set = function(text){
  try {
    var data = JSON.parse(text);
    PATTERN = createPattern(data);
    SITEINFO = data;
  } catch(e) {
  }
}

var createPattern = function(data){
  var exps = [];
  if(data && data.ldrfullfeed){
    for(var i in data.ldrfullfeed){
      data.ldrfullfeed[i].forEach(function(info){
        exps.push(info.url);
      });
    }
  }
  var expression = exps.join('|');
  return expression;
}

var update = (function(){
  var updating = false;
  return function(con){
    if(updating){
      con && con.postMessage({
        type    : 'update',
        info    : 'Now loading. Please wait!'
      });
    } else {
      con && con.postMessage({
        type    : 'update',
        info    : 'Resetting cache. Please wait... '
      });
      updating = true;
      new Cache(function(data){
        localStorage.text = JSON.stringify(data);
        SITEINFO = data;
        PATTERN = createPattern(data);
        updating = false;
        if(con){
          con.postMessage({
            type : "update",
            info : 'Resetting cache. Please wait... Done'
          });
          regset(con);
        }
      },
      function(){
        console.log('fail');
        con && con.postMessage({
          type  : "update",
          info  : "update failure"
        });
      });
    }
  }
})();

// [Cache]

var Cache = function(callback, error){
  var self = this;
  this.callback = callback;
  this.error = error;
  this.ldrfullfeed  = {};
  this.autopagerize = [AUTOPAGERIZE_MICROFORMAT];
  this.success = 0;
  this.error_flag = false;
  this.length = SITEINFO_IMPORT_URLS.length;
  this.error_flag || console.info('Resetting cache. Please wait...');

  PHASE.forEach(function(i){
      this.ldrfullfeed[i.type] = [];
  }, this);
  SITEINFO_IMPORT_URLS.forEach(function(obj, index) {
    var agent = new Agent(obj, this, index);
    agent.get();
  }, this);
}

Cache.prototype.finalize = function(){
  PHASE.forEach(function(p){
    this.ldrfullfeed[p.type].sort(function(a,b){
      return a.urlIndex - b.urlIndex;
    });
  }, this);
  var data = {
    VERSION      : VERSION,
    ldrfullfeed  : this.ldrfullfeed,
    autopagerize : this.autopagerize,
    date         : (new Date).getTime()
  };
  this.error_flag || console.info('Resetting cache. Please wait... Done');

  this.callback(data);
};

Cache.prototype.error = function(e){
  this.error_flag || console.info('Cache Error: '+e);
  this.error_flag = true;
  this.error();
};

var Agent = function(opt, Cache, index){
  for(var i in opt) opt.hasOwnProperty(i) && (this[i] = opt[i]);
  ['format', 'type'].forEach(function(prop){
    this[prop] = this[prop].toUpperCase();
  }, this);
  this.Cache = Cache;
  this._flag = false;
  this.index = index;
}

Agent.prototype = {
  get : function(){
    ChromeXHR(this);
  },
  method: 'GET',
  headers: {
    'User-Agent': navigator.userAgent + ' Greasemonkey (LDR Full Feed ' + VERSION + ')'
  },
  onload: function(res){
    this['onload_'+this.type](res);
  },
  onerror: function(code){
    if(!this._flag && this.alternative){
      this.Cache.error_flag || console.info(code+' Regain SITEINFO from alternative url');
      this._flag = true;
      this.url = this.alternative;
      ChromeXHR(this);
    } else {
      return this.Cache.error(code || 'Cache Request Error '+this.name);
    }
  },
  onload_AUTOPAGERIZE: function(res){
    var info = Agent[this.format].AUTOPAGERIZE(res.responseText, this.index);
    if(!info) return this.onerror(this.format+' Parse Error: '+this.name);
    var ap_list = this.Cache.autopagerize;
    info.forEach(function(i){
      ap_list.push(i);
    });
    ap_list.sort(function(a, b){ return b.url.length - a.url.length });
    if(++this.Cache.success == this.Cache.length) this.Cache.finalize();
  },
  onload_LDRFULLFEED: function(res){
    var info = Agent[this.format].LDRFULLFEED(res.responseText, this.index);
    if(!info) return this.onerror(this.format+' Parse Error: '+this.name);
    PHASE.forEach(function(i){
      var fullfeed_list = this.Cache.ldrfullfeed[i.type];
      info.filter(function(d){
        var type = d.type.toUpperCase();
        return (type == i.type || (i.sub && type == i.sub));
      })
      .forEach(function(d){
        fullfeed_list.push(d);
      });
    }, this);
    if(++this.Cache.success == this.Cache.length) this.Cache.finalize();
  },
  ontimeout: function(){
    this.onerror('Cache Error: TIMEOUT');
  }
};

Agent.JSON = {
  LDRFULLFEED: function(data, index){
    try {
      var memo = [];
      JSON.parse(data)
      .forEach(function(i){
        var d = i.data;
        d.name = i.name;
        d.microformats = (d.microformats == 'true');
        d.urlIndex = index;
        if(!(['url', 'xpath', 'type'].some(function(prop){
          if(!d[prop] && (prop != 'xpath' || !d.microformats)) return true;
          try{
            var reg = new RegExp(d.url);
          } catch(e) {
            return true;
          }
          return false;
        }))){
          memo.push(d);
        }
      });
      return memo;
    } catch(e) {
      return null;
    }
  },
  AUTOPAGERIZE: function(data, index){
    var info = [];
    var ap_list = this.autopagerize;
    try {
      var memo = [];
      JSON.parse(data)
      .forEach(function(i){
        var d = i.data;
        d.name = i.name;
        try{
          var reg = new RegExp(d.url);
          memo.push(d);
        } catch(e) {
        }
      });
      return memo;
    } catch(e) {
      return null;
    }
  }
};

Agent.HTML = {
  LDRFULLFEED: function(data, index){
    var info = [];
    try {
      var doc = parseHTML(data);
    } catch(e) {
      return null;
    }
    $X('//textarea[contains(concat(" ",normalize-space(@class)," "), " ldrfullfeed_data ")]', doc)
    .forEach(function(siteinfo_list){
      var data = parseSiteinfo(siteinfo_list.value, index);
      if(data) info.push(data);
    });

    ['utf-8','euc-jp','shift_jis'].forEach(function(charset){
      $X('//ul[contains(concat(" ",normalize-space(@class)," "), " microformats_list ' + charset + ' ")]/li', doc)
      .forEach(function(microformats_data){
        var data = parseMicroformats(charset, microformats_data, index);
        if(data) info.push(data);
      });
    });
    return info;
  }
};

var parseMicroformats = function(c, li, index){
  if(!li) return;
  var info = {
    name : "MicroformatsURLList:"+li.textContent,
    url : li.textContent,
    urlIndex : index,
    enc : c,
    microformats : true,
    type : 'INDIV_MICROFORMATS'
  }
  try {
    var reg = new RegExp(info.url);
    return info;
  } catch(e) {
    return null;
  }
};

var parseSiteinfo = function(text, index){
  var lines = text.split(/[\r\n]+/);
  var reg = /(^[^:]*?):(.*)$/;
  var info = {};
  var result = null;
  lines.forEach(function(line) {
    if(result = line.match(reg)){
      info[result[1]] = trim(result[2]);
    }
  });
  info.microformats = (info.microformats && info.microformats == 'true');
  if(['url', 'xpath', 'type'].some(function(prop){
    if(!info[prop] && (prop != 'xpath' || !info.microformats)) return true;
    try{
      var reg = new RegExp(info.url);
    } catch(e) {
      return true;
    }
    return false;
  })){
    return null;
  } else {
    return info;
  }
};

// initialize
if(!localStorage.text){
  set(localStorage.text);
} else {
  update();
}

var trim = function(str){
  return str.replace(/^\s*/, '').replace(/\s*$/, '');
}


