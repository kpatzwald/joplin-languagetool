// Ergänzende Skriptlogik für den LanguageTool-Ergebnisdialog.
// Wird über joplin.views.dialogs.addScript() in den Dialog geladen.
//
// Aufgabe: Die Korrekturvorschläge sind Buttons. Ein Klick schreibt die
// Wahl in ein verstecktes Eingabefeld (dessen Wert Joplin beim Schließen
// des Dialogs über das Formular serialisiert) und sendet das Formular ab,
// wodurch der Dialog wie mit „OK“ geschlossen wird.

(function () {
	'use strict';

	var form = document.querySelector('form[name="ltForm"]');
	if (!form) return;

	// Absenden ohne Seitennavigation: Der Joplin-Wrapper fängt das
	// submit-Ereignis ab und meldet es als „form-submit“ an das Plugin.
	form.addEventListener('submit', function (event) {
		event.preventDefault();
	});

	form.addEventListener('click', function (event) {
		var target = event.target;
		if (!target || !target.closest) return;
		var button = target.closest('.lt-sugg-btn');
		if (!button) return;

		var input = form.querySelector('input[name="ltReplaceChoice"]');
		if (input) input.value = button.getAttribute('data-choice') || '';
		if (form.requestSubmit) {
			form.requestSubmit();
		} else {
			form.submit();
		}
	});
})();
