// إنشاء عنصر <canvas> جديد
const canvas = document.createElement('canvas');

// الحصول على سياق الرسم ثنائي الأبعاد
const ctx = canvas.getContext('2d');

class RadioInput {
  // إنشاء مثيل للفئة مع تهيئة عناصر الإدخال مع تحديد التغيير 
  constructor(name, onChange) {
    // تحديد كافة العناصر التي تحمل نفس الاسم
    this.inputs = document.querySelectorAll(`input[name=${name}]`);
    
    // إضافة حدث التغيير لكل عنصر إدخال
    for (let input of this.inputs) {
      input.addEventListener('change', onChange);
    }
  }

  // إرجاع قيمة العنصر المحدد
  get value() {
    for (let input of this.inputs) {
      if (input.checked) {
        return input.value;
      }
    }
  }
}

class Input {
  // إنشاء مثيل للفئة مع تهيئة عنصر الإدخال بناءً على معرّف العنصر
  constructor(id, onChange) {
    this.input = document.getElementById(id);
    // إضافة حدث التغيير لعنصر الإدخال
    this.input.addEventListener('change', onChange);
    // تحديد نوع السمة المرتبطة بالقيمة سواء كانت للـ checkbox أو القيمة العادية
    this.valueAttrib = this.input.type === 'checkbox' ? 'checked' : 'value';
  }

  // إرجاع قيمة عنصر الإدخال
  get value() {
    return this.input[this.valueAttrib];
  }
}

class CubeFace {
  // إنشاء مثيل للفئة مع تعيين اسم الواجهة
  constructor(faceName) {
    this.faceName = faceName;

    // إنشاء رابط <a> لاحتواء الصورة
    this.anchor = document.createElement('a');
    this.anchor.style.position = 'absolute';
    this.anchor.title = faceName;

    // إنشاء عنصر الصورة <img> وتطبيق فلتر ضبابي
    this.img = document.createElement('img');
    this.img.style.filter = 'blur(4px)';

    // إضافة عنصر الصورة للرابط
    this.anchor.appendChild(this.img);
  }

  // تعيين المعاينة للصورة مع تحديد الموقع على الشاشة
  setPreview(url, x, y) {
    this.img.src = url;
    this.anchor.style.left = `${x}px`;
    this.anchor.style.top = `${y}px`;
  }

  // تعيين الرابط لتنزيل الصورة مع إزالة الفلتر الضبابي
  setDownload(url, fileExtension) {
    this.anchor.href = url;
    this.anchor.download = `${this.faceName}.${fileExtension}`;
    this.img.style.filter = '';
  }
}

// دالة لحذف جميع الأبناء من عنصر معين
function removeChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

// خريطة لتحديد أنواع ملفات الصور وامتداداتها
const mimeType = {
  'jpg': 'image/jpeg',
  'png': 'image/png'
};

// دالة لتحويل بيانات الصورة إلى URL
function getDataURL(imgData, extension) {
  // ضبط أبعاد الـ canvas لتطابق أبعاد الصورة
  canvas.width = imgData.width;
  canvas.height = imgData.height;
  
  // وضع بيانات الصورة على الـ canvas
  ctx.putImageData(imgData, 0, 0);
  
  // إنشاء كائن URL لتمثيل الصورة
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), mimeType[extension], 0.92);
  });
}

// كائن يحتوي على المراجع للعناصر الهامة في DOM
const dom = {
  imageInput: document.getElementById('imageInput'),
  faces: document.getElementById('faces'),
  generating: document.getElementById('generating')
};

// إضافة حدث التغيير لعنصر الإدخال لتحميل الصورة
dom.imageInput.addEventListener('change', loadImage);

// كائن يحتوي على إعدادات تحكم واجهة المكعب
const settings = {
  cubeRotation: new Input('cubeRotation', loadImage),
  interpolation: new RadioInput('interpolation', loadImage),
  format: new RadioInput('format', loadImage),
};

// تحديد مواقع الواجهات على الشاشة
const facePositions = {
  pz: {x: 1, y: 1},
  nz: {x: 3, y: 1},
  px: {x: 2, y: 1},
  nx: {x: 0, y: 1},
  py: {x: 1, y: 0},
  ny: {x: 1, y: 2}
};

// دالة لتحميل الصورة من ملف الإدخال
function loadImage() {
  const file = dom.imageInput.files[0];

  if (!file) {
    return;
  }

  const img = new Image();

  img.src = URL.createObjectURL(file);

  img.addEventListener('load', () => {
    const {width, height} = img;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, width, height);

    // معالجة الصورة بعد تحميلها
    processImage(data);
  });
}

// متغيرات لتتبع التقدم في المعالجة
let finished = 0;
let workers = [];

// دالة لمعالجة الصورة
function processImage(data) {
  // إزالة جميع الواجهات السابقة
  removeChildren(dom.faces);
  dom.generating.style.visibility = 'visible';

  // إيقاف أي عمليات سابقة للعمال
  for (let worker of workers) {
    worker.terminate();
  }

  // معالجة كل واجهة من واجهات المكعب
  for (let [faceName, position] of Object.entries(facePositions)) {
    renderFace(data, faceName, position);
  }
}

// دالة لرسم ومعالجة واجهة معينة من واجهات المكعب
function renderFace(data, faceName, position) {
  const face = new CubeFace(faceName);
  dom.faces.appendChild(face.anchor);

  const options = {
    data: data,
    face: faceName,
    rotation: Math.PI * settings.cubeRotation.value / 180,
    interpolation: settings.interpolation.value,
  };

  const worker = new Worker('convert.js');

  // دالة لتعيين الرابط لتنزيل الصورة
  const setDownload = ({data: imageData}) => {
    const extension = settings.format.value;

    getDataURL(imageData, extension)
      .then(url => face.setDownload(url, extension));

    finished++;

    // إخفاء مؤشر التوليد عند اكتمال جميع الواجهات
    if (finished === 6) {
      dom.generating.style.visibility = 'hidden';
      finished = 0;
      workers = [];
    }
  };

  // دالة لتعيين المعاينة للصورة قبل التنزيل
  const setPreview = ({data: imageData}) => {
    const x = imageData.width * position.x;
    const y = imageData.height * position.y;

    getDataURL(imageData, 'jpg')
      .then(url => face.setPreview(url, x, y));

    worker.onmessage = setDownload;
    worker.postMessage(options);
  };

  worker.onmessage = setPreview;
  worker.postMessage(Object.assign({}, options, {
    maxWidth: 200,
    interpolation: 'linear',
  }));

  // إضافة العامل لقائمة العمال
  workers.push(worker);
}
