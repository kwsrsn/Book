if (titles.length > 0 && images.length > 0) {
    const titlesParam = encodeURIComponent(JSON.stringify(titles));
    const imagesParam = encodeURIComponent(JSON.stringify(images));
    window.location.href = `/results?titles=${titlesParam}&images=${imagesParam}`;
} else {
    alert('No matching book titles found.');
}