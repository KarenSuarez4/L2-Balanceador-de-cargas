async function handleFiles(files) {
  try {
    loadingIndicator.style.display = "block";

    const uploadPromises = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map(async (file) => {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(`${API_URL}/upload`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Error al subir la imagen");
        }

        return response.json();
      });

    await Promise.all(uploadPromises);
    await loadImages();
    fileInput.value = "";
  } catch (error) {
    showNotification(`Error: ${error.message}`, "error");
    console.error("Error al subir imágenes:", error);
  } finally {
    loadingIndicator.style.display = "none";
  }
}
