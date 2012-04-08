$(function() {
    var $body = $(document.body);
    var $containers = $body.find('.containers');

    $containers.click(function(e) {
        $(this).toggleClass('open');
        e.stopPropagation();
    });

    $body.on('click', 'p.description', function() {
        var $this = $(this);
        var $input = $('<input data-repo="' + $this.data('repo')  +  '" class="description" value="' + $this.text() + '">');
        $this.replaceWith($input);
        $input.focus();
        return false;
    });

    $body.click(function() {
        $containers.removeClass('open');
        $(this).find('input.description').each(function(index, el) {
            var $el = $(el);
            var val = $el.val();
            var repo = $el.data('repo');
            $.post('/' + $el.data('repo') + '/description', { description: val }, function() {
                $el.replaceWith($('<p data-repo="' + repo + ' class="description">' + val + '</p>'));
            })
        });
    });

    Sunlight.highlightAll();
});
