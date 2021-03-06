

      // UNWHITELISTING

      // Look for a custom filter that would whitelist options.url,
      // and if any exist, remove the first one.
      // Inputs: url:string - a URL that may be whitelisted by a custom filter
      // Returns: true if a filter was found and removed; false otherwise.
      try_to_unwhitelist = function(url) {
        url = url.replace(/#.*$/, ''); // Whitelist ignores anchors
        var loweredUrl = url.toLowerCase();
        var custom_filters = get_custom_filters_text().split('\n');
        for (var i = 0; i < custom_filters.length; i++) {
          var text = custom_filters[i];
          if (!Filter.isWhitelistFilter(text))
            continue;
          var filter = PatternFilter.fromText(text);
          if (!filter.matches(url, loweredUrl, ElementTypes.document, false))
            continue;

          custom_filters.splice(i, 1); // Remove this whitelist filter text
          var new_text = custom_filters.join('\n');
          set_custom_filters_text(new_text);
          return true;
        }
        return false;
      }

      // CUSTOM FILTERS

      // Get the custom filters text as a \n-separated text string.
      get_custom_filters_text = function() {
        return storage_get('custom_filters') || '';
      }

      // Set the custom filters to the given \n-separated text string, and 
      // rebuild the filterset.
      // Inputs: filters:string the new filters.
      set_custom_filters_text = function(filters) {
        storage_set('custom_filters', filters);
        _myfilters.update();
      }

      // Removes a custom filter entry.
      // Inputs: filter:string line of text to remove from custom filters.
      remove_custom_filter = function(filter) {
        // Make sure every filter is preceded and followed by at least one \n,
        // then find and remove the filter.
        var text = "\n" + get_custom_filters_text() + "\n";
        text = text.replace("\n" + filter + "\n", "\n");
        set_custom_filters_text(text.trim());
      }

      // STORAGE

      // Inputs: key:string.
      // Returns value if key exists, else undefined.
      storage_get = function(key) {
        var json = localStorage.getItem(key);
        if (json == null)
          return undefined;
        try {
          return JSON.parse(json);
        } catch (e) {
          log("Couldn't parse json for " + key);
          return undefined;
        }
      }

      // Inputs: key:string, value:object.
      // Returns undefined.
      storage_set = function(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
      }
  
      // OPTIONAL SETTINGS

      get_settings = function() {
        (function() {
          // temp code to convert to simpler options storage, installed 3/11
          try {
            if (!storage_get('optional_features'))
              return;
            var old_options = storage_get('optional_features');
            var settings = {};
            for (var name in old_options) {
              settings[name] = old_options[name].is_enabled;
            }
            storage_set('settings', settings);
          } catch(ex) {}
          localStorage.removeItem('optional_features');
        })();

        var defaults = {
          debug_logging: false,
          block_youtube: true,
          show_youtube_help_msg: true,
          show_google_search_text_ads: false,
          show_context_menu_items: true,
          hide_instead_of_remove: false,
          show_advanced_options: false
        };
        var settings = storage_get('settings') || {};
        return $.extend(defaults, settings);
      }

      set_setting = function(name, is_enabled) {
        var settings = get_settings();
        settings[name] = is_enabled;
        storage_set('settings', settings);
        
        if (name == "debug_logging") {
          if (is_enabled)
            log = function(text) { console.log(text); };
          else
            log = function() { };
        }
      }
  
      // MYFILTERS PASSTHROUGHS

      // Rebuild the filterset based on the current settings and subscriptions.
      update_filters = function() {
        _myfilters.update();
      }

      // Fetch the latest version of all subscribed lists now.
      update_subscriptions_now = function() {
        _myfilters.freshen_async(true);
      }

      // Returns map from id to subscription object.  See filters.js for 
      // description of subscription object.
      get_subscriptions_minus_text = function() {
        return _myfilters.get_subscriptions_minus_text();
      }

      // Subscribes to a filter subscription.
      // Inputs: id: id to which to subscribe.  Either a well-known
      //             id, or "url:xyz" pointing to a user-specified list.
      //         text: filter text string fetched from that url
      //         requires: the id of a list if it is a supplementary list,
      //                   or null if nothing required
      // Returns: null, upon completion
      subscribe = function(id, text, requires) {
        _myfilters.subscribe(id, text, requires);
      }

      // Unsubscribes from a filter subscription.
      // Inputs: id: id from which to unsubscribe.
      //         del: (bool) if the filter should be removed or not
      // Returns: null, upon completion.
      unsubscribe = function(id, del) {
        _myfilters.unsubscribe(id, del);
      }

      // Return the scheme and domain for the given url.
      // TODO I have code in a few places that extracts domains, I think.
      // Deduplicate it.
      url_parts = function(url) {
        var parts = url.match("(.*?)://(..*?)/");
        if (!parts) // may be "about:blank" or similar
          parts = url.match("(.*?):(.*)");
        // TODO: crbug.com/81298 sometimes makes this break, but it doesn't
        // impact users visibly so I'm letting it break.
        var scheme = parts[1];
        var domain = parts[2];
        return {
          scheme: scheme,
          domain: domain
        };
      }
      // INFO ABOUT CURRENT PAGE

      // Get interesting information about the current tab.
      // Inputs:
      //   callback: function(info).
      //   info object passed to callback: {
      //     tab: Tab object
      //     whitelisted: bool - whether the current tab's URL is whitelisted.
      //     domain: string
      //     disabled_site: bool - true if the url is e.g. about:blank or the 
      //                           Extension Gallery, where extensions don't run.
      //   }
      // Returns: null (asynchronous)
      getCurrentTabInfo = function(callback) {
        chrome.tabs.getSelected(undefined, function(tab) {
          var url = url_parts(tab.url);

          var disabled_site = false;
          if (url.scheme != 'http' && url.scheme != 'https')
            disabled_site = true;
          if (/\:\/\/chrome.google.com\/webstore\//.test(tab.url))
            disabled_site = true;

          var result = {
            tab: tab,
            disabled_site: disabled_site,
            domain: url.domain,
          };
          if (!disabled_site)
            result.whitelisted = page_is_whitelisted(tab.url);

          callback(result);
        });
      }

      // Returns true if anything in whitelist matches the_domain.
      //   url: the url of the page
      //   type: one out of ElementTypes, default ElementTypes.document,
      //         to check what the page is whitelisted for: hiding rules or everything
      //   returnFilter: if the filter that whitelisted the page should be returned
      page_is_whitelisted = function(url, type, returnFilter) {
        //special case this one
        if (url == "http://acid3.acidtests.org/") return true;
        url = url.replace(/\#.*$/, ''); // Remove anchors
        var loweredUrl = url.toLowerCase();
        if (!type)
          type = ElementTypes.document;
        var whitelist = _myfilters.blocking.whitelist;
        var match = whitelist.matches(url, loweredUrl, type, url_parts(url).domain, false);
        if (match)
          return returnFilter ? match._text : true;
        return false;
      }

      if (!SAFARI) {
        // Set the button image and context menus according to the URL 
        // of the current tab.
        updateButtonUIAndContextMenus = function() {

          function setContextMenus(info) {
            chrome.contextMenus.removeAll();
            if (!get_settings().show_context_menu_items)
              return;

            function addMenu(title, callback) {
              chrome.contextMenus.create({
                title: title,
                contexts: ["all"],
                onclick: function(clickdata, tab) { callback(tab, clickdata); }
              });
            }

            if (ADBLOCK.isApp) {
              if (localStorage.adblock_is_paused) {
                addMenu(translate("unpause_adblock"), function(tab) {
                  localStorage.removeItem('adblock_is_paused');
                  setContextMenus(info);
                });
              }

              if (info.whitelisted) {
                var message = translate("adblock_is_disabled_on_domain", [info.domain]) +
                              " " + translate("undo");
                addMenu(message, function(tab) {
                  if (try_to_unwhitelist(tab.url))
                    chrome.tabs.update(tab.id, {url: tab.url}); // Reload tab
                  // else, silently fail.
                });
              }
            }

            if (localStorage.adblock_is_paused || info.whitelisted || info.disabled_site)
              return;

            if (ADBLOCK.isApp) {
              // TODO: these 3 are copy-and-modified from button/popup.html
              addMenu(translate("pause_adblock"), function(tab) {
                localStorage.adblock_is_paused = true;
                setContextMenus(info);
              });

              addMenu(translate("dont_run_on_this_page"), function(tab) {
                var url = tab.url.replace(/#.*$/, '');  // Remove anchors
                var url_parts = url.match(/^([^\?]+)(\??)/); // Detect querystring
                var has_querystring = url_parts[2];
                var filter = '@@|' + url_parts[1] + 
                  (has_querystring ? '?' : '|') + '$document';
                add_custom_filter({filter: filter});
                // Reload the tab
                chrome.tabs.update(tab.id, {url: tab.url});
              });

              addMenu(translate("dont_run_on_domain", [info.domain]), function(tab) {
                  emit_page_broadcast(
                  {fn:'top_open_whitelist_ui', options:{}},
                  {tab: tab} // fake sender to determine target page
                  );
              });
                }

            addMenu(translate("block_this_ad"), function(tab, clickdata) {
              emit_page_broadcast(
                {fn:'top_open_blacklist_ui', options:{info: clickdata}},
                {tab: tab}
              );
              });

            addMenu(translate("block_an_ad_on_this_page"), function(tab) {
                  emit_page_broadcast(
                    {fn:'top_open_blacklist_ui', options:{nothing_clicked: true}},
                {tab: tab}
                  );
              });
            }

          function setBrowserButton(info) {
            if (localStorage.adblock_is_paused) {
              chrome.browserAction.setIcon({path:"img/icon19-grayscale.png", tabId: info.tab.id});
            } else if (info.disabled_site && 
                !/^chrome-extension:.*pages\/install\//.test(info.tab.url)) {
              // Show non-disabled icon on the installation-success page so it
              // users see how it will normally look. All other disabled pages
              // will have the gray one
              chrome.browserAction.setIcon({path:"img/icon19-grayscale.png", tabId: info.tab.id});
            } else if (info.whitelisted) {
              chrome.browserAction.setIcon({path:"img/icon19-whitelisted.png", tabId: info.tab.id});
            } else {
              chrome.browserAction.setIcon({path:"img/icon19.png", tabId: info.tab.id});
            }
          }

          getCurrentTabInfo(function(info) {
            setContextMenus(info);
            setBrowserButton(info);
          });
        }
      }


      // These functions are usually only called by content scripts.

      // Add a new custom filter entry.
      // Inputs: filter:string line of text to add to custom filters.
      // Returns: null if succesfull, otherwise an exception
      add_custom_filter = function(filter) {
        var custom_filters = get_custom_filters_text();
        try {
          if (FilterNormalizer.normalizeLine(filter)) {
            custom_filters = custom_filters + '\n' + filter;
            set_custom_filters_text(custom_filters);
            return null;
          }
          return "This filter is unsupported";
        } catch(ex) {
          return ex;
        }
      };

      // Return the contents of a local file.
      // Inputs: file:string - the file relative address, eg "js/foo.js".
      // Returns: the content of the file.
      readfile = function(file) {
        // A bug in jquery prevents local files from being read, so use XHR.
        var xhr = new XMLHttpRequest();
        xhr.open("GET", chrome.extension.getURL(file), false);
        xhr.send();
        return xhr.responseText;
      };

      do_not_show_youtube_help_msg = function() {
        set_setting("show_youtube_help_msg", false);
      };

      // TODO: make better.
      // Inputs: options object containing:
      //           domain:string the domain of the calling frame.
      //           include_texts?:bool true if PatternFilter._text should be
      //                               appended to block filters.
      get_content_script_data = function(options, sender) {
        var whitelisted = page_is_whitelisted(sender.tab.url);
        var settings = get_settings();
        var result = {
          page_is_whitelisted: whitelisted,
          adblock_is_paused: localStorage.getItem('adblock_is_paused'),
          settings: settings,
          selectors: []
        };
        if (whitelisted)
          return result;

        // Not whitelisted, and running on adblock_start.  We have two tasks:
        // apply CSS-hiding rules, and send Chrome a filterset.

        if (!page_is_whitelisted(sender.tab.url, ElementTypes.elemhide)) {
          result.selectors = _myfilters.hiding.
            filtersFor(options.domain, function(f) { return f.selector; });
        }
        // Chrome needs the blocking filters in the content script until a
        // synchronous background communication API comes along.
        if (!SAFARI) {
          function packed(filter) {
            return [filter._rule.source, filter._allowedElementTypes, filter._options];
        }
          if (options.include_texts) {
            packed = function(filter) {
              return [filter._rule.source, filter._allowedElementTypes, filter._options, filter._text];
            }
          }
          result.patternSerialized = _myfilters.blocking.pattern.
            filtersFor(options.domain, packed);
          result.whitelistSerialized = _myfilters.blocking.whitelist.
            filtersFor(options.domain, packed);
        }

        return result;
      };

      // Bounce messages back to content scripts.
      if (!SAFARI) {
      emit_page_broadcast = (function() {
          var injectMap = {
            'top_open_whitelist_ui': {
              allFrames: false,
              include: [
                "uiscripts/load_jquery_ui.js",
                "uiscripts/top_open_whitelist_ui.js"
                ]
            },
            'top_open_blacklist_ui': {
              allFrames: false,
              include: [
                "uiscripts/load_jquery_ui.js",
                "uiscripts/blacklisting/overlay.js", 
                "uiscripts/blacklisting/clickwatcher.js",
                "uiscripts/blacklisting/elementchain.js",
                "uiscripts/blacklisting/blacklistui.js",
                "uiscripts/top_open_blacklist_ui.js"
                ]
            },
            'send_content_to_back': {
              allFrames: true,
              include: [ 
                'uiscripts/blacklisting/send_content_to_back.js' 
                ]
            }
          };
          // Inject the required scripts to execute fn_name(parameter) in
          // the current tab.
          // Inputs: fn_name:string name of function to execute on tab.
          //         fn_name must exist in injectMap above.
          //         parameter:object to pass to fn_name.  Must be JSON.stringify()able.
          //         injectedSoFar?:int used to recursively inject required scripts.
          var executeOnTab = function(fn_name, parameter, injectedSoFar) {
            injectedSoFar = injectedSoFar || 0;
            var data = injectMap[fn_name];
            var details = { allFrames: data.allFrames };
            // If there's anything to inject, inject the next item and recurse.
            if (data.include.length > injectedSoFar) {
              details.file = data.include[injectedSoFar];
              chrome.tabs.executeScript(undefined, details, function() {
                executeOnTab(fn_name, parameter, injectedSoFar + 1);
              });
            } 
            // Nothing left to inject, so execute the function.
            else {
              var param = JSON.stringify(parameter);
              details.code = fn_name + "(" + param + ");";
              chrome.tabs.executeScript(undefined, details);
            }
          };

          // The emit_page_broadcast() function
          var theFunction = function(request) {
            executeOnTab(request.fn, request.options);
          };
          return theFunction;
        })();
      }
      if (SAFARI) {
        emit_page_broadcast = (function() {
        // Private list of connected ports for emit_page_broadcast()
        var broadcast_ports = [];
        chrome.extension.onConnect.addListener(function(port) {
          port.onDisconnect.addListener(function(disconnected_port) {
            var where = broadcast_ports.indexOf(disconnected_port);
            if (where != -1) {
              broadcast_ports.splice(where, 1);
            }
          });
          broadcast_ports.push(port);
        });

        // The emit_page_broadcast() function
        var theFunction = function(request, sender) {
          $.each(broadcast_ports, function(i, port) {
              // issue 5416, fixed in Chrome and probably never happens in
              // Safari: port.sender.tab could be null for an unknown reason.
              if (!port.sender.tab)
                return;
            if (port.sender.tab.id == sender.tab.id)
              port.postMessage(request);
          });
        };
        return theFunction;
      })();
      }

      // Will open the resource blocking tab. 
      // Input: resources: array of resource strings; 
      //                   see resourceblock.html for format
      show_resourceblocker = (function() {
        // Stores resources used by resourceblock.html
        var _cached_resources = new FifoCache(5);

        var theFunction = function(resources, sender) {
          var url = sender.tab.url.replace(/\#.*/, '');
          _cached_resources.set(url, resources);
          chrome.tabs.create({url: "pages/resourceblock.html?url=" + escape(url)});
        };
        theFunction.cached_resources = _cached_resources; // make it public

        return theFunction;
      })();

      // Opens a popup that subscribes to a new list
      // Must be here because other pages cannot open popups...
      // Inputs: searchquery: the search part of the abp: url
      subscribe_popup = function(searchquery) {
        window.open(chrome.extension.getURL('pages/subscribe.html?' +
                    searchquery), "_blank", 
                    'scrollbars=0,location=0,resizable=0,width=450,height=140');
      };

      // Return chrome.i18n._getL10nData() for content scripts who cannot
      // call that function (since it loads extension files from disk.)
      // Only defined in Safari.
      get_l10n_data = (SAFARI ? chrome.i18n._getL10nData : undefined);


      // BGcall DISPATCH
      (function() {
        chrome.extension.onRequest.addListener(
          function(request, sender, sendResponse) { 
            if (request.command != "call")
              return; // not for us
            var fn = window[request.fn];
            request.args.push(sender);
            var result = fn.apply(window, request.args);
            sendResponse(result);
          }
        );
      })();


      // BROWSER ACTION AND CONTEXT MENU UPDATES
      (function() {
        if (SAFARI)
          return;

        //TEMP: until crbug.com/60435 is fixed, check if chrome.tabs exists.
        //Otherwise the extension doesn't work (e.g. doesn't block ads)
        if (chrome.tabs) {
          chrome.tabs.onUpdated.addListener(function(tabid, changeInfo, tab) {
            if (tab.selected)
              updateButtonUIAndContextMenus();
          });
          chrome.tabs.onSelectionChanged.addListener(function(tabid, selectInfo) {
            updateButtonUIAndContextMenus();
          });
        }
      })();

      // BROWSER ACTION BADGE
      (function() {
        if (SAFARI)
          return;

        // The string to display to the user in the "new version" div.
        // Update this whenever a release warrants a browser action
        // badge and an info div in the popup.  Note that it is
        // not compared with the manifest -- you can set it to whatever
        // value you want.
        version_to_notify = '2.3.0';

        // Brand new users don't see badge (or popup's info div).
        if (!storage_get('installed_at')) {
          localStorage.setItem('saw_badge_version', version_to_notify);
          localStorage.setItem('saw_badge_info_version', version_to_notify);
        }
        var saw = localStorage.getItem('saw_badge_version');
        if (saw != version_to_notify) {
          // If they haven't seen the latest, show it.
          chrome.browserAction.setTitle({title:translate("new_version")});
          chrome.browserAction.setBadgeBackgroundColor({color:[40,255,40,255]});
          chrome.browserAction.setBadgeText({text:"\u2022"}); // bullet
        }

      })();

      if (get_settings().debug_logging)
        log = function(text) { console.log(text); };
      
      _myfilters = new MyFilters();

      // If the user has just installed, make a note of it.  
      function note_install() {
        if (storage_get('installed_at'))
          return;

        var now = new Date().getTime();
        storage_set('installed_at', now);
        var flavor = (SAFARI ? "safari" : "chrome_ext");
        if (ADBLOCK.isApp) flavor = "chrome_app";
        var data = { installed_at: now, flavor: flavor, version: ADBLOCK.version, os: ADBLOCK.os };
        $.get("http://chromeadblock.com/api/visit.php", data);

        chrome.tabs.create({url: "pages/install/index.html?" + $.param(data)});
        }
      note_install();

      // Take a census of filter subscriptions.
      function take_census() {
        try {
          if (localStorage['tookSubscriptionCensus'] == null) {
            var data = {};
            data.subscriptions = [];
            for (var sub_id in _myfilters._subscriptions) {
              if (_myfilters._subscriptions[sub_id].subscribed) {
                data.subscriptions.push(sub_id);
              }
            }
            data.subscriptions = data.subscriptions.join(',');
            data.safari = SAFARI;
            data.language = navigator.language;
            data.installed_at = localStorage['installed_at'];
            data.options_at = localStorage['visited_options_at'];
            $.get(
              "http://chromeadblock.com/api/url_census.php", 
              data,
              function(result) {
                if (/OK/.test(result))
                  localStorage['tookSubscriptionCensus'] = true;
              }
            );
          }
        } catch (ex) { log("Census failed"); log(ex); }
      }
      // take_census(); uncomment when you want another census.


      // Safari specific code.
      if (SAFARI) {
        // True blocking support.
        safari.application.addEventListener("message", function(messageEvent) {
          if (messageEvent.name != "canLoad")
            return;

          if (page_is_whitelisted(messageEvent.target.url)) {
            messageEvent.message = true;
            return;
          }

          var url = messageEvent.message.url;
          var elType = messageEvent.message.elType;
          var pageDomain = messageEvent.message.pageDomain;

          var isMatched = url && (_myfilters.blocking.matches(url, elType, pageDomain));
          if (isMatched)
            log("SAFARI TRUE BLOCK " + url + ": " + isMatched);
          messageEvent.message = !isMatched;
        }, false);

        safari.application.addEventListener("command", function(commandEvent) {
          // Open Options page upon Toolbar button click.
          if (commandEvent.command == "AdBlockOptions")
            chrome.tabs.create({url: "options/index.html"});
          if (commandEvent.command in 
              {"show-whitelist-wizard": 1, "show-blacklist-wizard": 1, "show-clickwatcher-ui": 1 }) {
            safari.application.activeBrowserWindow.activeTab.page.dispatchMessage(commandEvent.command);
          }
        }, false);

        // Open Options page upon settings checkbox click.
        safari.extension.settings.openAdBlockOptions = false;
        safari.extension.settings.addEventListener("change", function(e) { 
          if (e.key == 'openAdBlockOptions')
            chrome.tabs.create({url: "options/index.html"});
        }, false);

        // Add context menus
        safari.application.addEventListener("contextmenu", function(event) {
          if (!event.userInfo)
            return;
          if (!get_settings().show_context_menu_items)
            return;
          event.contextMenu.appendContextMenuItem("show-blacklist-wizard", translate("block_this_ad"));
          event.contextMenu.appendContextMenuItem("show-clickwatcher-ui", translate("block_an_ad_on_this_page"));
          event.contextMenu.appendContextMenuItem("show-whitelist-wizard", translate("contextmenuexcludedomain"));
        }, false);
      }

      // TEMP: OLD STYLE WHITELIST
      (function() {
        //   TODO: Remove this when you are convinced everyone has updated their
        //   version of AdBlock... Say in March or April
        if (storage_get('whitelist')) {
          var old_style_whitelist = storage_get('whitelist') || [];
          for (var i=0; i<old_style_whitelist.length; i++) {
            var website = old_style_whitelist[i];
            if (website[0] == '.')
              website = '*' + website;
            add_custom_filter('@@||' + website + '^$document');
          }
          localStorage.removeItem('whitelist');
        }
      })();
    