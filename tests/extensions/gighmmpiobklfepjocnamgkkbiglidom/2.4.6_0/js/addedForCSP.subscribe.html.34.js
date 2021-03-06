
      $(function() {
        // Translation
        localizePage();

        // When the subscription is finished or aborted
        function finished(success) {
          $('#result').text(success ?
            translate("subscribingfinished") :
            translate("subscribingfailed"));
          window.setTimeout(function() {
            window.close();
          }, success ? 2000 : 3500);
        }

        //Get the URL
        var queryparts = {};
        var params = document.location.search.substring(1).split('&');
        for (var i = 0; i < params.length; i++)
          queryparts[params[i].split('=')[0]] = unescape(params[i].split('=')[1]);

        if (!/^https?\:\/\//i.test(queryparts.location)) {
          finished(false);
          return; // only should run on http/s pages
        }

        //Set the link to the list.  If it's really long, make it wrap nicely.
        $('a').
          attr('href', queryparts.location).
          text(queryparts.location.replace(/(.{64})/g, '$1 '));

        //subscribe to a list
        $.ajax({
          url: queryparts.location,
          cache: false,
          success: function(text) {
            if (text && 
                 (text[0] == '!' || text[0] == '[' || text[0] == '(')
               ) {
              var req = queryparts.requiresLocation ?
                        "url:" + queryparts.requiresLocation : null;

              var id = 'url:' + queryparts.location;
              BGcall("subscribe", id, text, req);
              finished(true);
            } else finished(false);
          },
          error: function() {finished(false);}
        });
      });
    