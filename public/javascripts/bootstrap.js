$(function() {
    $('.code').each(function(index, node) {
        node = $(node);
        node.addClass('sunlight-highlight-' + Sunlight.ExtensionMap[node.data('extension')]);
    });

    $('.change').dropkick({
      change: function (value, label) {
        if(value) {
            document.location.pathname = '/' + this.data('repo') + '/tree/' + value + '/';
        }
      }
    });

    $('[data-dk-dropdown-value=""]').addClass('dk_option_current_custom');
    Sunlight.highlightAll();

});
