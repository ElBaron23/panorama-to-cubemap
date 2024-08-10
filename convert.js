// دالة لضبط قيمة معينة بين حد أدنى وحد أقصى
function clamp(x, min, max) {
  // إعادة القيمة بين الحد الأدنى والأقصى
  return Math.min(max, Math.max(x, min));
}

// دالة لإيجاد باقي القسمة بشكل صحيح حتى مع الأرقام السالبة
function mod(x, n) {
  // تطبيق العملية الحسابية للحصول على باقي القسمة الصحيح
  return ((x % n) + n) % n;
}

// دالة لنسخ بكسل باستخدام أقرب نقطة
function copyPixelNearest(read, write) {
  // استخراج العرض والارتفاع وبيانات الصورة من البيانات المقروءة
  const {width, height, data} = read;
  // دالة لحساب فهرس البكسل بناءً على الإحداثيات
  const readIndex = (x, y) => 4 * (y * width + x);

  // إرجاع دالة لنسخ البكسل من مصدر معين إلى وجهة معينة
  return (xFrom, yFrom, to) => {
    // حساب أقرب بكسل باستخدام التقريب وضبطه ضمن الحدود
    const nearest = readIndex(
      clamp(Math.round(xFrom), 0, width - 1),
      clamp(Math.round(yFrom), 0, height - 1)
    );

    // نسخ قنوات اللون الأحمر والأخضر والأزرق للبكسل
    for (let channel = 0; channel < 3; channel++) {
      write.data[to + channel] = data[nearest + channel];
    }
  };
}

// دالة لنسخ بكسل باستخدام الاستيفاء الثنائي (bilinear)
function copyPixelBilinear(read, write) {
  // استخراج العرض والارتفاع وبيانات الصورة من البيانات المقروءة
  const {width, height, data} = read;
  // دالة لحساب فهرس البكسل بناءً على الإحداثيات
  const readIndex = (x, y) => 4 * (y * width + x);

  // إرجاع دالة لنسخ البكسل باستخدام الاستيفاء الثنائي
  return (xFrom, yFrom, to) => {
    // حساب الحدود اليسرى واليمنى للبكسل الأفقي وتحديد الفرق
    const xl = clamp(Math.floor(xFrom), 0, width - 1);
    const xr = clamp(Math.ceil(xFrom), 0, width - 1);
    const xf = xFrom - xl;

    // حساب الحدود العلوية والسفلية للبكسل الرأسي وتحديد الفرق
    const yl = clamp(Math.floor(yFrom), 0, height - 1);
    const yr = clamp(Math.ceil(yFrom), 0, height - 1);
    const yf = yFrom - yl;

    // حساب فهارس البكسلات الأربعة التي سيتم الاستيفاء بينها
    const p00 = readIndex(xl, yl);
    const p10 = readIndex(xr ,yl);
    const p01 = readIndex(xl, yr);
    const p11 = readIndex(xr, yr);

    // حساب قيمة كل قناة باستخدام الاستيفاء الثنائي
    for (let channel = 0; channel < 3; channel++) {
      const p0 = data[p00 + channel] * (1 - xf) + data[p10 + channel] * xf;
      const p1 = data[p01 + channel] * (1 - xf) + data[p11 + channel] * xf;
      write.data[to + channel] = Math.ceil(p0 * (1 - yf) + p1 * yf);
    }
  };
}

// دالة لتنفيذ الالتفاف باستخدام نواة معينة (kernel)
function kernelResample(read, write, filterSize, kernel) {
  // استخراج العرض والارتفاع وبيانات الصورة من البيانات المقروءة
  const {width, height, data} = read;
  // دالة لحساب فهرس البكسل بناءً على الإحداثيات
  const readIndex = (x, y) => 4 * (y * width + x);

  // حساب حجم الفلتر والحدود القصوى للعرض والارتفاع
  const twoFilterSize = 2 * filterSize;
  const xMax = width - 1;
  const yMax = height - 1;
  // إنشاء مصفوفات لحفظ قيم النواة لكل من المحاور x و y
  const xKernel = new Array(4);
  const yKernel = new Array(4);

  // إرجاع دالة لنسخ البكسل باستخدام الالتفاف
  return (xFrom, yFrom, to) => {
    // حساب الإحداثيات اليسرى والعلوية للبكسل
    const xl = Math.floor(xFrom);
    const yl = Math.floor(yFrom);
    const xStart = xl - filterSize + 1;
    const yStart = yl - filterSize + 1;

    // حساب قيم النواة على طول المحور x
    for (let i = 0; i < twoFilterSize; i++) {
      xKernel[i] = kernel(xFrom - (xStart + i));
      yKernel[i] = kernel(yFrom - (yStart + i));
    }

    // حساب القيمة النهائية للبكسل عن طريق الالتفاف على المحاور x و y
    for (let channel = 0; channel < 3; channel++) {
      let q = 0;

      for (let i = 0; i < twoFilterSize; i++) {
        const y = yStart + i;
        const yClamped = clamp(y, 0, yMax);
        let p = 0;
        for (let j = 0; j < twoFilterSize; j++) {
          const x = xStart + j;
          const index = readIndex(clamp(x, 0, xMax), yClamped);
          p += data[index + channel] * xKernel[j];
        }
        q += p * yKernel[i];
      }

      // تخزين القيمة النهائية للبكسل
      write.data[to + channel] = Math.round(q);
    }
  };
}

// دالة لنسخ بكسل باستخدام الاستيفاء الثلاثي (bicubic)
function copyPixelBicubic(read, write) {
  const b = -0.5;
  // دالة لحساب نواة الاستيفاء الثلاثي
  const kernel = x => {
    x = Math.abs(x);
    const x2 = x * x;
    const x3 = x * x * x;
    return x <= 1 ?
      (b + 2) * x3 - (b + 3) * x2 + 1 :
      b * x3 - 5 * b * x2 + 8 * b * x - 4 * b;
  };

  // استخدام الالتفاف لاستيفاء البكسل
  return kernelResample(read, write, 2, kernel);
}

// دالة لنسخ بكسل باستخدام استيفاء لانشوز (Lanczos)
function copyPixelLanczos(read, write) {
  const filterSize = 5;
  // دالة لحساب نواة استيفاء لانشوز
  const kernel = x => {
    if (x === 0) {
      return 1;
    } else {
      const xp = Math.PI * x;
      return filterSize * Math.sin(xp) * Math.sin(xp / filterSize) / (xp * xp);
    }
  };

  // استخدام الالتفاف لاستيفاء البكسل
  return kernelResample(read, write, filterSize, kernel);
}

// كائن يحتوي على الدوال التي تحدد اتجاه واجهة المكعب
const orientations = {
  pz: (out, x, y) => {
    out.x = -1;
    out.y = -x;
    out.z = -y;
  },
  nz: (out, x, y) => {
    out.x = 1;
    out.y = x;
    out.z = -y;
  },
  px: (out, x, y) => {
    out.x = x;
    out.y = -1;
    out.z = -y;
  },
  nx: (out, x, y) => {
    out.x = -x;
    out.y = 1;
    out.z = -y;
  },
  py: (out, x, y) => {
    out.x = -y;
    out.y = -x;
    out.z = 1;
  },
  ny: (out, x, y) => {
    out.x = y;
    out.y = -x;
    out.z = -1;
  }
};

// دالة لرسم ومعالجة واجهة معينة من المكعب
function renderFace({data: readData, face, rotation, interpolation, maxWidth = Infinity}) {

  // حساب عرض وارتفاع الواجهة بناءً على حجم الصورة
  const faceWidth = Math.min(maxWidth, readData.width / 4);
  const faceHeight = faceWidth;

  // إعداد الكائن الذي سيحتوي على إحداثيات واجهة المكعب
  const cube = {};
  const orientation = orientations[face];

  // إنشاء بيانات صورة جديدة لواجهة المكعب
  const writeData = new ImageData(faceWidth, faceHeight);

  // تحديد طريقة نسخ البكسل بناءً على نوع الاستيفاء
  const copyPixel =
    interpolation === 'linear' ? copyPixelBilinear(readData, writeData) :
    interpolation === 'cubic' ? copyPixelBicubic(readData, writeData) :
    interpolation ===
