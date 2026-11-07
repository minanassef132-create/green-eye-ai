
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/ZIlPfdEK3/";

let model = null;
let selectedImage = null;
let selection = null;
let isSelecting = false;
let startX = 0;
let startY = 0;

const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const cropSection = document.getElementById("cropSection");
const cropCanvas = document.getElementById("cropCanvas");
const resetCropBtn = document.getElementById("resetCropBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const result = document.getElementById("result");
const adviceText = document.getElementById("adviceText");

const ctx = cropCanvas.getContext("2d");

const advice = {
  "بلاستيك": "حاول وضع البلاستيك في حاويات إعادة التدوير المخصصة، واغسل العبوات قبل التخلص منها.",
  "ورق": "اجمع الورق والكرتون الجاف لإعادة تدويرهما، وتجنب خلطهما بالمخلفات العضوية.",
  "معادن": "يمكن إعادة تدوير المعادن مثل علب الألومنيوم والحديد. اجمعها بشكل منفصل.",
  "مواد عضويه": "يمكن تحويل المخلفات العضوية مثل بقايا الطعام وقشور الفاكهة إلى سماد طبيعي.",
  "اخرى": "حاول فصل هذه المخلفات عن المواد القابلة لإعادة التدوير، وتحقق من طريقة التخلص المناسبة منها."
};

async function loadModel() {
  try {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "جاري تحميل الذكاء الاصطناعي...";

    model = await tmImage.load(
      MODEL_URL + "model.json",
      MODEL_URL + "metadata.json"
    );

    analyzeBtn.textContent = "Analyze Image";
    analyzeBtn.disabled = !selectedImage;

    console.log("AI model is ready!");
  } catch (error) {
    console.error(error);
    analyzeBtn.textContent = "تعذر تحميل النموذج";
    result.textContent = "حدث خطأ أثناء تحميل نموذج الذكاء الاصطناعي. تحقق من اتصال الإنترنت وحاول تحديث الصفحة.";
  }
}

function drawImage() {
  if (!selectedImage) return;

  const maxWidth = 1200;
  const scale = Math.min(1, maxWidth / selectedImage.naturalWidth);

  cropCanvas.width = Math.round(selectedImage.naturalWidth * scale);
  cropCanvas.height = Math.round(selectedImage.naturalHeight * scale);

  ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  ctx.drawImage(selectedImage, 0, 0, cropCanvas.width, cropCanvas.height);

  if (selection) {
    drawSelection();
  }
}

function drawSelection() {
  if (!selection) return;

  const { x, y, width, height } = selection;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

  ctx.clearRect(x, y, width, height);

  ctx.drawImage(
    selectedImage,
    x * selectedImage.naturalWidth / cropCanvas.width,
    y * selectedImage.naturalHeight / cropCanvas.height,
    width * selectedImage.naturalWidth / cropCanvas.width,
    height * selectedImage.naturalHeight / cropCanvas.height,
    x,
    y,
    width,
    height
  );

  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function getCanvasPosition(event) {
  const rect = cropCanvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) * cropCanvas.width / rect.width,
    y: (event.clientY - rect.top) * cropCanvas.height / rect.height
  };
}

cropCanvas.addEventListener("pointerdown", (event) => {
  if (!selectedImage) return;

  event.preventDefault();
  cropCanvas.setPointerCapture(event.pointerId);

  const pos = getCanvasPosition(event);

  startX = Math.max(0, Math.min(cropCanvas.width, pos.x));
  startY = Math.max(0, Math.min(cropCanvas.height, pos.y));

  isSelecting = true;
  selection = {
    x: startX,
    y: startY,
    width: 0,
    height: 0
  };

  drawImage();
});

cropCanvas.addEventListener("pointermove", (event) => {
  if (!isSelecting) return;

  const pos = getCanvasPosition(event);
  const x = Math.max(0, Math.min(cropCanvas.width, pos.x));
  const y = Math.max(0, Math.min(cropCanvas.height, pos.y));

  selection = {
    x: Math.min(startX, x),
    y: Math.min(startY, y),
    width: Math.abs(x - startX),
    height: Math.abs(y - startY)
  };

  drawImage();
});

function finishSelection() {
  if (!isSelecting) return;

  isSelecting = false;

  if (!selection || selection.width < 5 || selection.height < 5) {
    selection = null;
  }

  drawImage();
}

cropCanvas.addEventListener("pointerup", finishSelection);
cropCanvas.addEventListener("pointercancel", finishSelection);

resetCropBtn.addEventListener("click", () => {
  selection = null;
  drawImage();
  result.innerHTML = "";
  adviceText.textContent = "";
});

imageInput.addEventListener("change", (event) => {
  const file = event.target.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    result.textContent = "من فضلك اختر ملف صورة صالح.";
    return;
  }

  const imageURL = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    selectedImage = image;
    selection = null;

    preview.innerHTML = "";
    cropSection.style.display = "block";

    drawImage();

    analyzeBtn.disabled = !model;
    result.innerHTML = "";
    adviceText.textContent = "";

    URL.revokeObjectURL(imageURL);
  };

  image.onerror = () => {
    result.textContent = "تعذر فتح الصورة. جرب صورة أخرى.";
    URL.revokeObjectURL(imageURL);
  };

  image.src = imageURL;
});

analyzeBtn.addEventListener("click", async () => {
  if (!model || !selectedImage) return;

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "جاري التحليل...";
  result.innerHTML = "<p>الذكاء الاصطناعي بيحلل الصورة...</p>";
  adviceText.textContent = "";

  try {
    let predictions;

    if (selection) {
      const crop = document.createElement("canvas");

      const scaleX = selectedImage.naturalWidth / cropCanvas.width;
      const scaleY = selectedImage.naturalHeight / cropCanvas.height;

      const sx = Math.round(selection.x * scaleX);
      const sy = Math.round(selection.y * scaleY);
      const sw = Math.round(selection.width * scaleX);
      const sh = Math.round(selection.height * scaleY);

      crop.width = sw;
      crop.height = sh;

      crop.getContext("2d").drawImage(
        selectedImage,
        sx, sy, sw, sh,
        0, 0, sw, sh
      );

      predictions = await model.predict(crop);
    } else {
      predictions = await model.predict(selectedImage);
    }

    predictions.sort((a, b) => b.probability - a.probability);

    const best = predictions[0];
    const confidence = (best.probability * 100).toFixed(2);

    let html = `
      <h3>نتيجة التحليل</h3>
      <h2>التصنيف: ${best.className}</h2>
      <p><strong>نسبة الثقة:</strong> ${confidence}%</p>
      <h3>جميع التصنيفات</h3>
    `;

    predictions.forEach((item) => {
      const percentage = (item.probability * 100).toFixed(2);

      html += `
        <p><strong>${item.className}</strong> — ${percentage}%</p>
        <div style="background:#dcfce7;border-radius:20px;height:12px;overflow:hidden;margin-bottom:12px;">
          <div style="background:#16a34a;width:${percentage}%;height:100%;"></div>
        </div>
      `;
    });

    result.innerHTML = html;
    adviceText.textContent =
      advice[best.className] || "حاول التخلص من المخلفات بطريقة آمنة ومناسبة.";

  } catch (error) {
    console.error(error);
    result.textContent = "حدث خطأ أثناء تحليل الصورة. حاول مرة أخرى.";
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Image";
  }
});

loadModel();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(() => console.log("Service Worker registered!"))
      .catch((error) => console.error("Service Worker error:", error));
  });
}
