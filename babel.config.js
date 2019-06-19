module.exports = function (api) {
    api.cache(true);
    const presets = [
        [
            '@babel/preset-env',
            {
                targets: ['>0.5% in ES', 'last 3 Edge versions', 'IE 11']
            }
        ]
    ];
    const plugins= [
        'angularjs-annotate',
        'lodash'
    ];
    return {
        presets,
        plugins
    }
};