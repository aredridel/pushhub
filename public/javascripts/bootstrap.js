$(function() {
    $('.code').each(function(index, node) {
        node = $(node);
        node.addClass('sunlight-highlight-' + Sunlight.ExtensionMap[node.data('extension')]);
    });

    $('.change').dropkick({
      change: function (value, label) {
        if(value) {
            $('#refswitch').submit();
        }
      }
    });

    $('[data-dk-dropdown-value=""]').addClass('dk_option_current_custom');
    $('[data-dk-dropdown-value="' + $('#ref').data('current') + '"]').append($('<span></span>').addClass('pictogram ok'));
    Sunlight.highlightAll();

});
