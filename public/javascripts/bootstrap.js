
$(function() {
    var $body = $(document.body);
    var $codes = $('.code');
    var $containers = $('.container');

    //TODO: Do this from the backend
    $codes.each(function(index, node) {
        node = $(node);
        node.addClass('sunlight-highlight-' + Sunlight.ExtensionMap[node.data('extension')]);
    });

    Sunlight.highlightAll();

    $containers.click(function(e) {
        $(this).toggleClass('open');
        e.stopPropagation();
    });

    $body.click(function() {
        $containers.removeClass('open');
    });
});
