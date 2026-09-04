export type DesignExample = {
  id: string;
  title: string;
  description: string;
  price: number;
  imageData: string;
  active: boolean;
};

export const imageFileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error('Selecciona un archivo de imagen.'));
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    reject(new Error('La imagen debe pesar menos de 12 MB.'));
    return;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    const maxSide = 1100;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('No se pudo preparar la imagen.'));
      return;
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let result = canvas.toDataURL('image/webp', .76);
    if (result.length > 780_000) result = canvas.toDataURL('image/webp', .58);
    if (result.length > 900_000) {
      reject(new Error('La imagen sigue siendo demasiado pesada. Prueba con otra foto.'));
      return;
    }
    resolve(result);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('No pudimos leer esa imagen.'));
  };
  image.src = objectUrl;
});
