const app = document.getElementById('app');
const buttons = document.querySelectorAll('.steps button');
const stageBadge = document.getElementById('stageBadge');

const Store = {
  step: 'details',
  products: []
};

const QUESTIONS = [
  'האם קיימות מחלות רקע?',
  'האם בוצעו אשפוזים בשנים האחרונות?',
  'האם נוטל תרופות קבועות?',
  'היסטוריה רפואית משפחתית?'
];

function render(){
  stageBadge.textContent = Store.step;
  app.innerHTML = '';

  if(Store.step === 'details'){
    app.innerHTML = `
      <div class="card">
        <h3>פרטים אישיים</h3>
        <div class="field">
          <label>שם מלא</label>
          <input>
        </div>
      </div>`;
  }

  if(Store.step === 'products'){
    app.innerHTML = `
      <div class="card">
        <h3>מוצרים</h3>
        <button onclick="addProduct()">הוסף מוצר</button>
      </div>`;
  }

  if(Store.step === 'questions'){
    app.innerHTML = `
      <div class="card">
        <h3>שאלון רפואי</h3>
        ${QUESTIONS.map(q => `
          <div style="margin:8px 0">
            ${q}
            <button>כן</button>
            <button>לא</button>
          </div>`).join('')}
      </div>`;
  }

  if(Store.step === 'payment'){
    app.innerHTML = `
      <div class="card">
        <h3>תשלום</h3>
        <div class="field">
          <label>אמצעי תשלום</label>
          <input>
        </div>
      </div>`;
  }

  if(Store.step === 'summary'){
    app.innerHTML = `
      <div class="card">
        <h3>סיכום</h3>
        <button>שמור</button>
      </div>`;
  }
}

function addProduct(){
  Store.products.push({});
  alert('נוסף מוצר');
}

buttons.forEach(btn=>{
  btn.onclick = ()=>{
    buttons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    Store.step = btn.dataset.step;
    render();
  };
});

render();
