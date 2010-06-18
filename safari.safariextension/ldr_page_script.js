if(!window.LDRFullFeed){
  var LDRFullFeed = {};
}
LDRFullFeed.loadCurrentEntry = null;
(function(){
var PATTERN = null;
var ICON = null;
var ADCHECKER = /(^AD:|^PR:)/;
var loadCurrentEntry = function(id){
  id || (id = get_active_item(true).id);
  if(!id) return;
  var item = get_item_info(id);
  if(ADCHECKER.test(item.title)){
    message('This entry is advertisement');
    return null;
  }
  var container = $('item_' + item.id);
  if(hasClass(container, 'chrome_fullfeed_loaded')){
    var text = Object.toJSON({
      id : item.id,
    });
    var ev = document.createEvent('MessageEvent');
    ev.initMessageEvent('LDRFullFeed.autopager', true, false, text, location.protocol+"//"+location.host, "", null);
    container.dispatchEvent(ev);
    return null;
  }
  if(hasClass(container, 'chrome_fullfeed_loading')){
    message('Now loading...');
    return null;
  }
  var text = Object.toJSON({
    feedURL : get_active_feed().channel.link,
    itemURL : item.link,
    title   : item.title,
    id      : item.id
  });
  var ev = document.createEvent('MessageEvent');
  ev.initMessageEvent('LDRFullFeed.load', true, false, text, location.protocol+"//"+location.host, "", window);
  container.dispatchEvent(ev);
}
LDRFullFeed.loadCurrentEntry = loadCurrentEntry;
var loadAllEntries = function(){
  var items = get_active_feed().items;
  if(items && items.length > 0){
    items.forEach(function(item){
      loadCurrentEntry(item.id);
    });
  }
}
var updateSiteinfo = function(){
  var ev = document.createEvent('Event');
  ev.initEvent('LDRFullFeed.reset', true, true);
  document.dispatchEvent(ev);
}

var id = setTimeout(function(){
  if (id) clearTimeout(id);
  if (typeof Keybind != 'undefined' && typeof entry_widgets != 'undefined') {
    Keybind.add('g', function(){loadCurrentEntry()});
    Keybind.add('u', loadAllEntries);
    Keybind.add('G', updateSiteinfo);

    // registration icon
    entry_widgets.add('chrome_fullfeed_widget', function(feed, item){
      if(ICON && PATTERN && (PATTERN.test(item.link) || PATTERN.test(feed.channel.link)) && !ADCHECKER.test(item.title)) {
        return [
          '<img class="chrome_fullfeed_icon" id="chrome_fullfeed_widget_'+item.id+'" src="'+ICON+'" onclick="LDRFullFeed.loadCurrentEntry(\''+item.id+'\')">'
        ].join('');
      }
    }, "\u5168\u6587\u53d6\u5f97\u3067\u304d\u308b\u3088\uff01");

  } else {
    id = setTimeout(arguments.callee, 100);
  }
}, 0);

var id2 = setTimeout(function(){
  if(id2) clearTimeout(id2);
  if(LDRFullFeed.SUB){
    PATTERN = new RegExp(LDRFullFeed.SUB.PATTERN);
    ICON = LDRFullFeed.SUB.ICON;
    delete LDRFullFeed["SUB"];
  } else {
    id2 = setTimeout(arguments.callee, 100);
  }
}, 100);

})();

