$(function() {
    var $body = $(document.body);
    var $containers = $body.find('.container');
    var readme = $('.tree-list .name').filter(function(index, el) { return el.innerText.match(/^readme/i) });

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
            $.post('/' + repo + '/description', { description: val }, function() {
                $el.replaceWith($('<p data-repo="' + repo + ' class="description">' + val + '</p>'));
            })
        });
    });

    if(readme.length > 0 && $body.data('view') === 'tree') {
      $.get('/' + [$body.data('repo'), 'preview', $body.data('ref'), readme.get(0).innerText].join('/'), function(json) {
        var preview = $('<div class="preview padding15"></div>').html(json.data);
        var title = $('<h2/>').text(json.path);
        $('.tree-list-wrapper').after(title, preview);
      });
    }

    if($body.data('view') === 'blob') {
      Sunlight.highlightAll();
    }
});
