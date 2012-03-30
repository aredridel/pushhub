
$(function() {
    var $body = $(document.body);
    var $containers = $('.container');

    Sunlight.highlightAll();

    $containers.click(function(e) {
        $(this).toggleClass('open');
        e.stopPropagation();
    });

    $body.click(function() {
        $containers.removeClass('open');
    });
});
