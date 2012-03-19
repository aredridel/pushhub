var nodes = [].slice.apply(document.querySelectorAll('.code'));
nodes.forEach(function(node) {
    node.classList.add('sunlight-highlight-' + Sunlight.ExtensionMap[node.dataset.extension]);
});
Sunlight.highlightAll();
