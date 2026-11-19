/**
 * Silo Admin JS — AJAX polling, animated scan, toast notifications.
 *
 * @package silo-connector
 */
(function ($) {
	'use strict';

	var pollTimer = null;
	var scanPollTimer = null;

	// -- Toast ----------------------------------------------------------

	function toast(message, type) {
		var $t = $('#silo-toast');
		$t.text(message)
			.removeClass('silo-toast-success silo-toast-error')
			.addClass(type === 'error' ? 'silo-toast-error' : 'silo-toast-success')
			.fadeIn(200);
		clearTimeout($t.data('timer'));
		$t.data('timer', setTimeout(function () { $t.fadeOut(200); }, 3500));
	}

	// -- Stats polling --------------------------------------------------

	function pollStats() {
		if (!siloAdmin.isConnected) return;

		$.post(siloAdmin.ajaxUrl, {
			action: 'silo_get_stats',
			nonce: siloAdmin.nonce
		}, function (res) {
			if (!res.success) return;
			var d = res.data;
			$('#silo-hit-rate').text(d.hit_rate + '%');
			$('#silo-cached-pages').text(formatNumber(d.cached_pages));
			$('#silo-total-hits').text(formatNumber(d.hits));
		});
	}

	function startPolling() {
		if (pollTimer) return;
		pollStats();
		pollTimer = setInterval(pollStats, 10000);
	}

	function stopPolling() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	// Pause when tab not visible.
	document.addEventListener('visibilitychange', function () {
		if (document.hidden) {
			stopPolling();
		} else {
			startPolling();
		}
	});

	// -- Connect flow ---------------------------------------------------

	function initConnect() {
		$('#silo-connect-btn').on('click', function () {
			var key = $('#silo-api-key').val().trim();
			if (!key) {
				toast('Enter an API key', 'error');
				return;
			}

			var $btn = $(this);
			$btn.find('.silo-btn-text').hide();
			$btn.find('.silo-btn-spinner').show();
			$btn.prop('disabled', true);

			$('#silo-scan-progress').slideDown(200);
			startScanPolling();

			$.post(siloAdmin.ajaxUrl, {
				action: 'silo_connect',
				nonce: siloAdmin.nonce,
				api_key: key
			}, function (res) {
				stopScanPolling();
				if (res.success) {
					$('#silo-scan-fill').css('width', '100%');
					$('#silo-scan-message').text('Connected! Reloading...');
					toast('Store connected', 'success');
					setTimeout(function () { location.reload(); }, 1200);
				} else {
					$btn.find('.silo-btn-text').show();
					$btn.find('.silo-btn-spinner').hide();
					$btn.prop('disabled', false);
					toast(res.data || 'Connection failed', 'error');
				}
			}).fail(function () {
				stopScanPolling();
				$btn.find('.silo-btn-text').show();
				$btn.find('.silo-btn-spinner').hide();
				$btn.prop('disabled', false);
				toast('Request failed', 'error');
			});
		});
	}

	function startScanPolling() {
		scanPollTimer = setInterval(function () {
			$.post(siloAdmin.ajaxUrl, {
				action: 'silo_scan_progress',
				nonce: siloAdmin.nonce
			}, function (res) {
				if (!res.success) return;
				var d = res.data;
				$('#silo-scan-fill').css('width', d.percent + '%');
				$('#silo-scan-message').text(d.message || d.stage);
			});
		}, 800);
	}

	function stopScanPolling() {
		if (scanPollTimer) {
			clearInterval(scanPollTimer);
			scanPollTimer = null;
		}
	}

	// -- Settings -------------------------------------------------------

	function initSettings() {
		// Feature toggles.
		$('.silo-toggle input').on('change', function () {
			var $input = $(this);
			var option = $input.data('option');
			var value = $input.is(':checked') ? '1' : '0';

			$.post(siloAdmin.ajaxUrl, {
				action: 'silo_save_settings',
				nonce: siloAdmin.nonce,
				option: option,
				value: value
			}, function (res) {
				if (res.success) {
					toast('Setting saved', 'success');
				} else {
					toast(res.data || 'Failed', 'error');
					$input.prop('checked', !$input.is(':checked'));
				}
			});
		});

		// Test connection.
		$('#silo-test-connection-btn').on('click', function () {
			var $btn = $(this).text('Testing...');
			$.post(siloAdmin.ajaxUrl, {
				action: 'silo_test_connection',
				nonce: siloAdmin.nonce
			}, function (res) {
				$btn.text('Test Connection');
				toast(res.success ? res.data : (res.data || 'Failed'), res.success ? 'success' : 'error');
			}).fail(function () {
				$btn.text('Test Connection');
				toast('Request failed', 'error');
			});
		});

		// Purge all.
		$('#silo-purge-all-btn').on('click', function () {
			if (!confirm('Purge ALL cached pages? Stats will be reset.')) return;
			var $btn = $(this).text('Purging...');
			$.post(siloAdmin.ajaxUrl, {
				action: 'silo_purge_all',
				nonce: siloAdmin.nonce
			}, function (res) {
				$btn.text('Purge All');
				if (res.success) {
					toast('Purged ' + res.data.purged + ' files', 'success');
					pollStats();
				} else {
					toast('Purge failed', 'error');
				}
			});
		});

		// Disconnect.
		$('#silo-disconnect-btn').on('click', function () {
			if (!confirm('Disconnect this store from Silo? Cache files will remain but syncing stops.')) return;
			$.post(siloAdmin.ajaxUrl, {
				action: 'silo_disconnect',
				nonce: siloAdmin.nonce
			}, function (res) {
				if (res.success) {
					toast('Disconnected', 'success');
					setTimeout(function () { location.reload(); }, 1000);
				}
			});
		});
	}

	// -- Filter ---------------------------------------------------------

	function initFilters() {
		$('#silo-event-filter').on('change', function () {
			var filter = $(this).val().toLowerCase();
			$('#silo-invalidation-log .silo-table tbody tr').each(function () {
				var badge = $(this).find('.silo-badge').text().toLowerCase();
				$(this).toggle(!filter || badge.indexOf(filter) !== -1);
			});
		});
	}

	// -- Helpers --------------------------------------------------------

	function formatNumber(n) {
		return Number(n).toLocaleString();
	}

	// -- Init -----------------------------------------------------------

	$(function () {
		initConnect();
		initSettings();
		initFilters();

		if (siloAdmin.isConnected && $('#silo-kpi-grid').length) {
			startPolling();
		}
	});

})(jQuery);
