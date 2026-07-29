const statusText = document.querySelector('#status-text');
const resultOutput = document.querySelector('#result-output');

function setStatus(message, tone = 'info') {
  statusText.textContent = message;
  resultOutput.dataset.tone = tone;
}

function getTypingSample(textarea) {
  const value = textarea.value.trim();
  const characters = [...value];
  const holdTimes = characters.map((character, index) => Number(((character.codePointAt(0) % 9) + 6 + index * 0.3).toFixed(2)));
  const flightTimes = characters.map((character, index) => Number(((character.codePointAt(0) % 7) + 4 + index * 0.2).toFixed(2)));

  return {
    phrase: value,
    holdTimes,
    flightTimes
  };
}

async function submitForm(form, endpoint) {
  const formData = new FormData(form);
  const typingField = form.querySelector('textarea[name="typing"]');
  const sample = getTypingSample(typingField);

  const payload = Object.fromEntries(formData.entries());
  payload.phrase = payload.phrase?.trim();
  payload.holdTimes = sample.holdTimes;
  payload.flightTimes = sample.flightTimes;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

function wireForm(form, endpoint, successMessage) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('Processing request...');

    try {
      const data = await submitForm(form, endpoint);
      setStatus(successMessage, 'success');
      resultOutput.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      setStatus(error.message, 'error');
      resultOutput.textContent = JSON.stringify({ error: error.message }, null, 2);
    }
  });
}

wireForm(document.querySelector('#register-form'), '/api/register', 'Account created.');
wireForm(document.querySelector('#enroll-form'), '/api/enroll', 'Typing profile saved.');
wireForm(document.querySelector('#login-form'), '/api/login', 'Login complete.');

setStatus('Ready to enroll and verify typing behavior.');
