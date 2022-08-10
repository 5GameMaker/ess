
export = [
    ["css", "text/css"],
    ["svg", "image/svg+xml"],
    ["tif", "image/tiff"],
    ["ico", "image/x-icon"],
    ["cur", "image/x-icon"],
    ...["jpg", "jpeg", "jfif", "pjpeg", "pjp"].map(a => [a, "image/jpeg"]),
    ...["png", "webp", "gif", "avif", "apng", "bmp", "tiff"].map(a => [a, "image/" + a]),
    ...["js", "json", "xml", "yaml"].map(a => [a, "application/" + a]),
];
