window.addEventListener('load', function() {
    var container = document.querySelector('.container');

    container.addEventListener('click', function(e) {
        container.classList.toggle('open');
        e.stopPropagation();
    }, true);

    document.body.addEventListener('click', function(e) {
        container.classList.remove('open');
    }, false);

    Sunlight.highlightAll();
});
