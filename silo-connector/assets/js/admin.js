/**
 * Silo for WooCommerce — admin app.
 *
 * Renders connect → live scan → overview/catalog/invalidations/warmup/status/settings
 * from one state object that is refreshed from WordPress every few seconds.
 */
/* global siloAdmin */
( function () {
	'use strict';

	const cfg = window.siloAdmin || {};
	const root = document.getElementById( 'silo-app' );
	if ( ! root ) {
		return;
	}

	const VIEWS = [ 'overview', 'catalog', 'invalidations', 'warmup', 'status', 'settings' ];
	const POLL_MS = 3000;
	const SERIES_LEN = 40;
	const NODE_COUNT = 144;

	const S = {
		state: {},
		view: VIEWS.indexOf( location.hash.slice( 1 ) ) >= 0 ? location.hash.slice( 1 ) : 'overview',
		renderedView: '',
		expanded: {},
		filter: '',
		filtered: null,
		more: null,
		series: Array.from( { length: SERIES_LEN }, () => ( { h: 0, m: 0, b: 0 } ) ),
		prev: null,
		maxId: null,
		flash: {},
		checks: null,
		entries: null,
		confirm: '',
		busy: '',
		connectError: '',
		form: { key: '', saas: '' },
		advanced: false,
		scanView: false,
		scanHidden: false,
		driving: false,
		tweens: {},
		nodesOn: 0,
		timer: null,
		pollError: '',
	};

	/* ------------------------------------------------------------------ */
	/* Helpers                                                             */
	/* ------------------------------------------------------------------ */

	const esc = ( v ) =>
		String( v === null || v === undefined ? '' : v ).replace( /[&<>"']/g, ( c ) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ c ] ) );
	const num = ( v ) => Number( v || 0 ).toLocaleString();
	const sleep = ( t ) => new Promise( ( r ) => setTimeout( r, t ) );

	function ms( v ) {
		v = Number( v || 0 );
		if ( v >= 1000 ) {
			return ( v / 1000 ).toFixed( v >= 10000 ? 0 : 1 ) + 's';
		}
		return Math.round( v ) + 'ms';
	}

	function bytes( b ) {
		b = Number( b || 0 );
		if ( b < 1024 ) {
			return b + ' B';
		}
		if ( b < 1048576 ) {
			return ( b / 1024 ).toFixed( 1 ) + ' KB';
		}
		if ( b < 1073741824 ) {
			return ( b / 1048576 ).toFixed( 1 ) + ' MB';
		}
		return ( b / 1073741824 ).toFixed( 2 ) + ' GB';
	}

	function seconds( ts ) {
		if ( ! ts ) {
			return null;
		}
		const t = typeof ts === 'number' ? ts * 1000 : Date.parse( ts );
		return Math.max( 0, Math.round( ( Date.now() - t ) / 1000 ) );
	}

	function ago( ts ) {
		const s = seconds( ts );
		if ( s === null ) {
			return '—';
		}
		if ( s < 5 ) {
			return 'just now';
		}
		if ( s < 60 ) {
			return s + 's ago';
		}
		if ( s < 3600 ) {
			return Math.floor( s / 60 ) + 'm ago';
		}
		if ( s < 86400 ) {
			return Math.floor( s / 3600 ) + 'h ago';
		}
		return Math.floor( s / 86400 ) + 'd ago';
	}

	function clock( ts ) {
		const d = new Date( typeof ts === 'number' ? ts * 1000 : ts );
		return d.toLocaleTimeString( [], { hour: '2-digit', minute: '2-digit', second: '2-digit' } );
	}

	function pathOf( url ) {
		try {
			const u = new URL( url );
			return decodeURI( u.pathname + u.search ) || '/';
		} catch ( e ) {
			return String( url || '' );
		}
	}

	function hostOf( url ) {
		try {
			return new URL( url ).host;
		} catch ( e ) {
			return url || '';
		}
	}

	function tw( key, value, decimals, suffix ) {
		return '<span data-tw="' + esc( key ) + '" data-to="' + Number( value || 0 ) + '" data-dec="' + ( decimals || 0 ) + '" data-suf="' + esc( suffix || '' ) + '">' + Number( value || 0 ).toLocaleString( undefined, { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0 } ) + esc( suffix || '' ) + '</span>';
	}

	const ICONS = {
		overview: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
		catalog: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>',
		invalidations: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
		warmup: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
		status: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
		settings: '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
		shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
		external: '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
		refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
		trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
		check: '<path d="M20 6 9 17l-5-5"/>',
		download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
		arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
		flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
	};

	const icon = ( name ) =>
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ( ICONS[ name ] || '' ) + '</svg>';

	const mark = ( lg ) => '<span class="silo-mark' + ( lg ? ' is-lg' : '' ) + '" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';

	/* ------------------------------------------------------------------ */
	/* Server                                                              */
	/* ------------------------------------------------------------------ */

	async function api( action, data ) {
		const body = new FormData();
		body.append( 'action', 'silo_' + action );
		body.append( 'nonce', cfg.nonce );
		Object.keys( data || {} ).forEach( ( k ) => body.append( k, typeof data[ k ] === 'object' ? JSON.stringify( data[ k ] ) : data[ k ] ) );

		const res = await fetch( cfg.ajax, { method: 'POST', credentials: 'same-origin', body } );
		let json = null;
		try {
			json = await res.json();
		} catch ( e ) {
			json = null;
		}
		if ( ! json ) {
			throw new Error( 'WordPress returned an unexpected response (HTTP ' + res.status + ').' );
		}
		if ( ! json.success ) {
			throw new Error( ( json.data && json.data.message ) || 'Request failed.' );
		}
		return json.data;
	}

	function ingest( state ) {
		const s = state && state.stats;
		if ( s && S.prev && S.prev.epoch === s.epoch ) {
			S.series.push( {
				h: Math.max( 0, s.hits - S.prev.hits ),
				m: Math.max( 0, s.misses - S.prev.misses ),
				b: Math.max( 0, s.bypass - S.prev.bypass ),
			} );
			S.series = S.series.slice( -SERIES_LEN );
		} else if ( s && S.prev && S.prev.epoch !== s.epoch ) {
			S.series = Array.from( { length: SERIES_LEN }, () => ( { h: 0, m: 0, b: 0 } ) );
		}
		S.prev = s ? { epoch: s.epoch, hits: s.hits, misses: s.misses, bypass: s.bypass } : null;

		const events = ( state && state.events ) || [];
		const top = events.reduce( ( m, e ) => Math.max( m, e.id ), 0 );
		if ( null !== S.maxId ) {
			events.forEach( ( e ) => {
				if ( e.id > S.maxId ) {
					S.flash[ e.id ] = Date.now() + 2400;
				}
			} );
		}
		S.maxId = Math.max( S.maxId || 0, top );
		S.state = state || {};
	}

	function schedule() {
		clearTimeout( S.timer );
		if ( document.hidden || ! S.state.connected ) {
			return;
		}
		S.timer = setTimeout( poll, POLL_MS );
	}

	async function poll() {
		try {
			const state = await api( 'live' );
			ingest( state );
			S.pollError = '';
			if ( S.filter && 'invalidations' === S.view ) {
				S.filtered = await api( 'events', { group: S.filter } );
			}
			if ( state.scan && 'running' === state.scan.status && ! S.driving ) {
				driveScan();
			}
		} catch ( e ) {
			S.pollError = e.message;
		}
		render();
		schedule();
	}

	async function refresh() {
		try {
			ingest( await api( 'live' ) );
		} catch ( e ) {
			S.pollError = e.message;
		}
		render();
	}

	function toast( message, kind ) {
		const old = document.querySelector( '.silo-root .silo-toast' );
		if ( old ) {
			old.remove();
		}
		const el = document.createElement( 'div' );
		el.className = 'silo-toast ' + ( 'error' === kind ? 'is-error' : 'is-ok' );
		el.setAttribute( 'role', 'status' );
		el.innerHTML = '<span class="silo-dot"></span><span>' + esc( message ) + '</span>';
		( document.querySelector( '.silo-root' ) || document.body ).appendChild( el );
		setTimeout( () => el.remove(), 4200 );
	}

	function download( name, type, content ) {
		const a = document.createElement( 'a' );
		a.href = URL.createObjectURL( new Blob( [ content ], { type } ) );
		a.download = name;
		document.body.appendChild( a );
		a.click();
		a.remove();
		setTimeout( () => URL.revokeObjectURL( a.href ), 1000 );
	}

	function toCsv( rows ) {
		if ( ! rows.length ) {
			return '';
		}
		const cols = Object.keys( rows[ 0 ] );
		const cell = ( v ) => '"' + String( null === v || undefined === v ? '' : 'object' === typeof v ? JSON.stringify( v ) : v ).replace( /"/g, '""' ) + '"';
		return [ cols.join( ',' ) ].concat( rows.map( ( r ) => cols.map( ( c ) => cell( r[ c ] ) ).join( ',' ) ) ).join( '\n' );
	}

	async function exportData( kind ) {
		S.busy = 'export-' + kind;
		render();
		try {
			const data = await api( 'export', { kind } );
			const stamp = new Date().toISOString().slice( 0, 10 );
			const host = ( ( S.state.site && S.state.site.host ) || 'store' ).replace( /[^a-z0-9.-]/gi, '' );
			if ( 'diagnostics' === kind ) {
				download( 'silo-diagnostics-' + host + '-' + stamp + '.json', 'application/json', JSON.stringify( data, null, 2 ) );
			} else if ( ! data.length ) {
				toast( 'Nothing to export yet' );
			} else {
				download( 'silo-' + kind + '-' + host + '-' + stamp + '.csv', 'text/csv', toCsv( data ) );
				toast( 'Exported ' + num( data.length ) + ' rows' );
			}
		} catch ( e ) {
			toast( e.message, 'error' );
		}
		S.busy = '';
		render();
	}

	function exportButton( kind, label ) {
		const busy = 'export-' + kind === S.busy;
		return '<button type="button" class="silo-btn" data-act="export" data-kind="' + kind + '"' + ( busy ? ' disabled' : '' ) + '>' + ( busy ? '<span class="silo-spin"></span>' : icon( 'download' ) ) + esc( label || 'Export CSV' ) + '</button>';
	}

	/* ------------------------------------------------------------------ */
	/* Shared pieces                                                       */
	/* ------------------------------------------------------------------ */

	function syncPill() {
		const st = S.state;
		if ( ! st.connected ) {
			return '<span class="silo-pill">Not connected</span>';
		}
		if ( st.env && st.env.auth_error ) {
			return '<span class="silo-pill is-rose"><span class="silo-dot"></span>Key rejected</span>';
		}
		const age = st.heartbeat && st.heartbeat.ok ? ( st.now || Date.now() / 1000 ) - st.heartbeat.ok : null;
		if ( null !== age && age < 150 ) {
			return '<span class="silo-pill is-mint"><span class="silo-pulse"></span>Connector online</span>';
		}
		if ( st.heartbeat && st.heartbeat.error ) {
			return '<span class="silo-pill is-amber"><span class="silo-dot"></span>Silo unreachable</span>';
		}
		return '<span class="silo-pill is-amber"><span class="silo-dot"></span>Syncing…</span>';
	}

	function topbar() {
		const st = S.state;
		return (
			'<header class="silo-top">' +
			'<div class="silo-brand">' + mark() + '<span class="silo-wordmark">silo</span><span class="silo-for">for WooCommerce</span></div>' +
			'<div class="silo-top-right">' +
			'<span class="silo-host">' + esc( ( st.store && st.store.name ) || ( st.site && st.site.host ) || '' ) + '</span>' +
			syncPill() +
			'<span class="silo-chip">v' + esc( st.version || cfg.version || '' ) + '</span>' +
			'</div></header>'
		);
	}

	const STATE_CHIPS = {
		queued: [ 'is-accent is-pulse', 'Sending' ],
		purged: [ '', 'Purged' ],
		warming: [ 'is-amber is-pulse', 'Warming' ],
		warm: [ 'is-mint', 'Re-warmed' ],
		local: [ 'is-amber', 'Purged on-site' ],
		limited: [ 'is-rose', 'Plan limit' ],
		failed: [ 'is-rose', 'Failed' ],
		done: [ '', 'Done' ],
	};

	function stateChip( state ) {
		const c = STATE_CHIPS[ state ] || [ '', state ];
		return '<span class="silo-chip ' + c[ 0 ] + '">' + esc( c[ 1 ] ) + '</span>';
	}

	function eventRows( events, opts ) {
		if ( ! events || ! events.length ) {
			return (
				'<tr><td colspan="' + ( opts && opts.time ? 6 : 5 ) + '"><div class="silo-empty"><strong>No invalidations yet</strong>' +
				'Change a product, its stock or price in WooCommerce and the event appears here within a second.</div></td></tr>'
			);
		}
		const now = Date.now();
		let html = '';
		events.forEach( ( e ) => {
			const isNew = ( S.flash[ e.id ] || 0 ) > now;
			const open = Object.prototype.hasOwnProperty.call( S.expanded, e.id );
			const scope = e.purged ? num( e.purged ) + ' URLs' : ( 0 === e.type.indexOf( 'system.' ) || 'purge.all' === e.type ? 'full purge' : '—' );
			const warm = e.warm_total ? ' · ' + num( e.warm_total ) + ' warm' : '';
			const timing = e.duration_ms ? ms( e.duration_ms ) : ( e.local_ms ? ms( e.local_ms ) + ' local' : '—' );
			html +=
				'<tr class="is-row' + ( open ? ' is-open' : '' ) + ( isNew ? ' is-new' : '' ) + '" data-act="toggle-row" data-id="' + e.id + '">' +
				'<td><span class="caret">▸</span><span class="trigger">' + esc( e.type ) + '</span></td>' +
				'<td><div class="object">' + esc( e.object || '—' ) + '</div><div class="detail">' + esc( e.detail ) + '</div></td>' +
				'<td class="num">' + esc( scope + warm ) + '</td>' +
				'<td class="num">' + esc( timing ) + '</td>' +
				( opts && opts.time ? '<td class="num" title="' + esc( e.created_at ) + '">' + esc( ago( e.created_at ) ) + '</td>' : '' ) +
				'<td class="right">' + stateChip( e.state ) + '</td></tr>';
			if ( open ) {
				html += '<tr class="silo-expand"><td colspan="' + ( opts && opts.time ? 6 : 5 ) + '">' + eventDetail( e, S.expanded[ e.id ] ) + '</td></tr>';
			}
		} );
		return html;
	}

	function urlList( urls, cls ) {
		if ( ! urls || ! urls.length ) {
			return '<p class="silo-dim">None</p>';
		}
		return urls.map( ( u ) => '<p class="' + ( cls || '' ) + '" title="' + esc( u ) + '">' + esc( pathOf( u ) ) + '</p>' ).join( '' );
	}

	function eventDetail( row, detail ) {
		if ( ! detail ) {
			return '<div class="silo-empty" style="min-height:60px"><span class="silo-spin"></span></div>';
		}
		const scope = detail.scope || {};
		const trace = [];
		trace.push( [ '0ms', esc( detail.type ) + ' received from WooCommerce', 'ok' ] );
		trace.push( [ '+' + ms( detail.local_ms ), 'purge on-site · ' + num( scope.pages || 0 ) + ' cached pages · ' + num( scope.api || 0 ) + ' Store API entries', 'ok' ] );
		if ( detail.event_id ) {
			trace.push( [ '+' + ms( detail.duration_ms ), 'Silo resolved scope · ' + num( ( scope.resolved || [] ).length ) + ' URLs', 'ok' ] );
		} else if ( 'queued' === detail.state ) {
			trace.push( [ '…', 'sending to Silo', 'queued' ] );
		} else if ( 'local' === detail.state ) {
			trace.push( [ '—', 'Silo unreachable · on-site purge kept the catalog correct', 'queued' ] );
		}
		if ( detail.warm_total ) {
			trace.push( [ '', 'warm.queue(' + num( detail.warm_total ) + ' priority URLs)', 'warm' === detail.state ? 'complete' : 'queued' ] );
		}

		const payload = detail.payload ? JSON.stringify( detail.payload, null, 2 ) : '';
		return (
			'<div class="silo-expand-grid">' +
			'<div><div class="silo-eyebrow">Event trace</div><div class="silo-trace">' +
			trace.map( ( t ) => '<div><span class="t">' + t[ 0 ] + '</span><span class="e">' + t[ 1 ] + '</span><span class="s' + ( 'queued' === t[ 2 ] ? ' is-amber' : '' ) + '">' + t[ 2 ] + '</span></div>' ).join( '' ) +
			'</div></div>' +
			'<div><div class="silo-eyebrow">Purged on-site (' + num( ( scope.local || [] ).length ) + ')</div><div class="silo-urlbox">' + ( scope.all ? '<p>Entire cache</p>' : urlList( scope.local ) ) + '</div></div>' +
			'<div><div class="silo-eyebrow">Resolved by Silo (' + num( ( scope.resolved || [] ).length ) + ')</div><div class="silo-urlbox">' + urlList( scope.resolved ) + '</div></div>' +
			'<div><div class="silo-eyebrow">Re-warmed (' + num( ( scope.warm || [] ).length ) + ')</div><div class="silo-urlbox">' + urlList( scope.warm, 'is-mint' ) + '</div></div>' +
			( payload ? '<div style="grid-column:1/-1"><div class="silo-eyebrow">Payload</div><div class="silo-urlbox" style="max-height:220px"><pre>' + esc( payload ) + '</pre></div></div>' : '' ) +
			'</div>'
		);
	}

	function eventTable( events, opts ) {
		return (
			'<div class="silo-table-wrap"><table class="silo-table"><thead><tr>' +
			'<th>Trigger</th><th>Object</th><th>Scope</th><th>Duration</th>' + ( opts && opts.time ? '<th>When</th>' : '' ) + '<th class="right">State</th>' +
			'</tr></thead><tbody>' + eventRows( events, opts ) + '</tbody></table></div>'
		);
	}

	/* ------------------------------------------------------------------ */
	/* Connect                                                             */
	/* ------------------------------------------------------------------ */

	function connectView() {
		const st = S.state;
		const saasDefault = st.saas_default || '';
		const showSaas = S.advanced || ! saasDefault;
		const busy = 'connect' === S.busy;

		return (
			'<div class="silo-connect"><div class="silo-connect-card">' +
			mark( true ) +
			'<h1>Connect this store to Silo</h1>' +
			'<p class="lede">Paste the store key from your Silo dashboard. Silo maps your catalog — products, variations, archives and Store API routes — then starts caching with surgical invalidation.</p>' +
			'<div class="silo-steps"><span class="is-active">1 · Key</span><span>2 · Scan</span><span>3 · Live</span></div>' +
			'<form class="silo-form" data-form="connect" autocomplete="off">' +
			'<div class="silo-field"><label for="silo-key">Store key</label>' +
			'<input id="silo-key" type="text" name="key" spellcheck="false" placeholder="sk_silo_…" value="' + esc( S.form.key ) + '" required>' +
			'<span class="help">Shown once in Silo under Stores → Add store. It is scoped to this store only.</span></div>' +
			( showSaas
				? '<div class="silo-field"><label for="silo-saas">Silo service URL</label><input id="silo-saas" type="url" name="saas" spellcheck="false" placeholder="https://" value="' + esc( S.form.saas || st.saas_url || '' ) + '"><span class="help">The address of your Silo dashboard.</span></div>'
				: '<button type="button" class="silo-link silo-disclose" data-act="advanced">Connecting to ' + esc( hostOf( saasDefault ) ) + ' · change</button>' ) +
			( S.connectError ? '<div class="silo-error">' + esc( S.connectError ) + '</div>' : '' ) +
			'<button type="submit" class="silo-btn is-primary is-lg is-block"' + ( busy ? ' disabled' : '' ) + '>' + ( busy ? '<span class="silo-spin"></span>Verifying key…' : 'Connect &amp; scan catalog' ) + '</button>' +
			'</form>' +
			'<div class="silo-foot"><span>Outbound HTTPS only</span><span>Cart &amp; checkout never cached</span><span>Works with HPOS</span></div>' +
			'</div></div>'
		);
	}

	async function doConnect( form ) {
		S.form.key = ( form.key.value || '' ).trim();
		S.form.saas = form.saas ? ( form.saas.value || '' ).trim() : '';
		S.busy = 'connect';
		S.connectError = '';
		render();
		try {
			const state = await api( 'connect', { key: S.form.key, saas_url: S.form.saas } );
			ingest( state );
			S.busy = '';
			S.scanView = true;
			S.scanHidden = false;
			S.nodesOn = 0;
			render();
			schedule();
			driveScan();
		} catch ( e ) {
			S.busy = '';
			S.connectError = e.message;
			render();
		}
	}

	/* ------------------------------------------------------------------ */
	/* Scan                                                                */
	/* ------------------------------------------------------------------ */

	function showScan() {
		const scan = S.state.scan || {};
		if ( ! S.state.connected ) {
			return false;
		}
		if ( 'running' === scan.status ) {
			return ! S.scanHidden;
		}
		if ( ! scan.status || 'failed' === scan.status ) {
			return ! S.state.config || ! S.state.config.version || S.scanView;
		}
		return S.scanView;
	}

	async function driveScan() {
		if ( S.driving ) {
			return;
		}
		S.driving = true;
		try {
			for ( ;; ) {
				const scan = await api( 'scan_step' );
				S.state.scan = scan;
				render();
				if ( 'running' !== scan.status ) {
					break;
				}
				await sleep( 'catalog' === scan.stage ? 180 : 520 );
			}
			await refresh();
		} catch ( e ) {
			toast( e.message, 'error' );
		}
		S.driving = false;
	}

	function scanView() {
		const scan = S.state.scan || {};
		const counts = scan.counts || {};
		const status = scan.status || 'idle';
		const pct = 'complete' === status ? 100 : Number( scan.percent || 0 );
		const stageLabel = ( ( scan.stages || [] ).find( ( s ) => 'active' === s.state ) || {} ).label || 'Preparing';
		const origin = 'silo' === scan.origin ? 'started from the Silo dashboard' : 'started from WordPress';

		let title = 'Mapping your catalog';
		let sub = stageLabel + '…';
		if ( 'complete' === status ) {
			title = 'Catalog mapped';
			const r = scan.result || {};
			sub = 'Profile v' + ( r.config_version || 0 ) + ' applied' + ( r.tier ? ' · ' + r.tier.charAt( 0 ).toUpperCase() + r.tier.slice( 1 ) + ' plan' : '' ) + ' · ' + num( counts.nodes ) + ' graph nodes';
		} else if ( 'failed' === status ) {
			title = 'Scan stopped';
			sub = scan.error || 'The scan could not finish.';
		} else if ( 'idle' === status ) {
			title = 'Ready to scan';
			sub = 'Map the catalog to generate this store’s cache profile.';
		}

		// Catalog graph: nodes light up as the scan progresses.
		const on = Math.round( ( pct / 100 ) * NODE_COUNT );
		let nodes = '';
		for ( let i = 0; i < NODE_COUNT; i++ ) {
			const kind = 0 === i % 7 ? ' a' : 0 === i % 5 ? ' m' : '';
			const lit = i < on;
			const pop = lit && i >= S.nodesOn ? ' pop' : '';
			nodes += '<i class="' + ( lit ? 'on' + kind + pop : '' ) + '"></i>';
		}
		S.nodesOn = on;

		const stages = ( scan.stages || [] )
			.map( ( s ) => {
				const mark2 = 'done' === s.state ? '✓' : 'failed' === s.state ? '✕' : 'active' === s.state ? '<span class="silo-spin" style="width:14px;height:14px"></span>' : '';
				return '<div class="silo-stage is-' + s.state + '"><span class="st">' + mark2 + '</span><span>' + esc( s.label ) + '</span></div>';
			} )
			.join( '' );

		const types = Object.keys( scan.types || {} )
			.sort( ( a, b ) => scan.types[ b ] - scan.types[ a ] )
			.map( ( t ) => '<span class="silo-chip is-accent">' + esc( t.replace( /-/g, ' ' ) ) + ' · ' + num( scan.types[ t ] ) + '</span>' )
			.join( '' );

		const log = ( scan.log || [] ).map( ( l ) => '<div><span class="t">' + esc( clock( l.t ) ) + '</span><span class="m">' + esc( l.m ) + '</span></div>' ).join( '' );

		const counters = [
			[ 'Products', counts.products, 'products' ],
			[ 'Variations', counts.variations, 'variations' ],
			[ 'Archives', counts.archives, 'archives' ],
			[ 'Store API routes', counts.routes, 'routes' ],
			[ 'Priority URLs', counts.priority, 'priority' ],
		]
			.map( ( c ) => '<div class="silo-counter"><span class="label">' + c[ 0 ] + '</span><span class="value">' + tw( 'scan-' + c[ 2 ], c[ 1 ] ) + '</span></div>' )
			.join( '' );

		let footer = '';
		if ( 'complete' === status ) {
			const w = ( S.state.warmup && S.state.warmup.counts ) || {};
			const pending = ( w.queued || 0 ) + ( w.warming || 0 );
			const warmText = pending ? num( pending ) + ' priority URLs warming now' : ( scan.result && scan.result.warm_total ? 'Priority pages warmed' : 'Warmup ready' );
			footer =
				'<div class="silo-done-banner"><span class="icon">' + icon( 'check' ) + '</span><div><div class="t">Silo is live on this store</div>' +
				'<div class="d">Cache is serving, invalidation is armed, ' + esc( warmText ) + '.' + ( scan.result && scan.result.warning ? ' ' + esc( scan.result.warning ) : '' ) + '</div></div>' +
				'<button type="button" class="silo-btn is-primary" data-act="open-overview">Open overview</button></div>';
		} else if ( 'failed' === status || 'idle' === status ) {
			footer =
				'<div class="silo-note" style="display:flex;align-items:center;gap:12px;justify-content:space-between"><span>' + esc( 'failed' === status ? sub : 'No scan has completed yet.' ) + '</span>' +
				'<button type="button" class="silo-btn" data-act="rescan">' + icon( 'refresh' ) + ( 'failed' === status ? 'Retry scan' : 'Start scan' ) + '</button></div>';
		}

		return (
			'<div class="silo-scan">' +
			'<div class="silo-scan-head"><div><p class="silo-eyebrow">Catalog scan · ' + esc( origin ) + '</p><h1>' + esc( title ) + '</h1><p class="sub">' + esc( sub ) + '</p></div>' +
			'<div class="silo-scan-pct">' + tw( 'scan-pct', pct ) + '<small>%</small></div></div>' +
			'<div class="silo-scan-bar' + ( 'complete' === status ? ' is-done' : 'failed' === status ? ' is-failed' : '' ) + '"><i style="width:' + pct + '%"></i></div>' +
			'<div class="silo-scan-grid">' +
			'<div class="silo-card"><div class="silo-eyebrow">Stages</div><div class="silo-stages silo-mt">' + stages + '</div></div>' +
			'<div class="silo-card silo-graph"><div class="silo-card-head"><h3>Catalog graph</h3><span class="meta">' + num( counts.nodes ) + ' nodes · ' + num( counts.edges ) + ' edges</span></div>' +
			'<div class="silo-nodes">' + nodes + '</div>' +
			'<div class="silo-graph-legend"><span><i style="background:var(--accent)"></i>products</span><span><i style="background:var(--mint)"></i>variations</span><span><i style="background:rgba(255,255,255,.22)"></i>archives &amp; routes</span></div>' +
			( types ? '<div class="silo-types">' + types + '</div>' : '' ) +
			'</div>' +
			'<div class="silo-counters">' + counters + '</div>' +
			'</div>' +
			'<div class="silo-terminal" data-terminal>' + ( log || '<div><span class="m">Waiting for the connector…</span></div>' ) + '</div>' +
			footer +
			( 'running' === status ? '<p class="silo-mt" style="text-align:center"><button type="button" class="silo-link" data-act="hide-scan">Continue in the background</button></p>' : '' ) +
			'</div>'
		);
	}

	/* ------------------------------------------------------------------ */
	/* App shell                                                           */
	/* ------------------------------------------------------------------ */

	function shell() {
		const st = S.state;
		const w = ( st.warmup && st.warmup.counts ) || {};
		const pending = ( w.queued || 0 ) + ( w.warming || 0 );
		const labels = { overview: 'Overview', catalog: 'Catalog', invalidations: 'Invalidations', warmup: 'Warmup', status: 'Status', settings: 'Settings' };

		const nav = VIEWS.map(
			( v ) =>
				'<button type="button" class="' + ( v === S.view ? 'is-active' : '' ) + '" data-act="nav" data-view="' + v + '">' + icon( v ) + labels[ v ] +
				( 'warmup' === v && pending ? '<span class="silo-count">' + num( pending ) + '</span>' : '' ) +
				( 'invalidations' === v && st.queued ? '<span class="silo-count">' + num( st.queued ) + '</span>' : '' ) +
				'</button>'
		).join( '' );

		const keycard =
			'<div class="silo-keycard"><div class="label"><span>Store key</span><span class="silo-mint">' + icon( 'shield' ).replace( '<svg', '<svg width="12" height="12"' ) + '</span></div>' +
			'<div class="key">' + esc( st.key_hint ) + '</div>' +
			'<div class="meta">profile v' + esc( ( st.config && st.config.version ) || 0 ) + ' · connector v' + esc( st.version ) + '</div></div>';

		const banner =
			st.scan && 'running' === st.scan.status
				? '<div class="silo-note" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 16px"><span>Catalog scan in progress · ' + num( st.scan.percent ) + '%</span><button type="button" class="silo-btn" data-act="show-scan">View scan</button></div>'
				: '';

		const plan = st.plan || {};
		const pn = st.plan_notice;
		const planBanner = pn
			? '<div class="silo-plan-banner is-' + ( 'error' === pn.tone ? 'error' : 'warning' ) + '" role="alert"><span>' + esc( pn.text ) + '</span>' +
				( pn.url ? '<a class="silo-btn" href="' + esc( pn.url ) + '" target="_blank" rel="noopener noreferrer">' + esc( pn.cta ) + '</a>' : '' ) + '</div>'
			: '';

		const used = Number( plan.events_used || 0 );
		const limit = Number( plan.events_limit || 0 );
		const pct = limit ? Math.min( 100, ( used / limit ) * 100 ) : 0;
		const planCard = plan.state
			? '<div class="silo-plancard"><div class="label"><span>Plan</span><span>' + esc( plan.state === 'trial' ? 'Trial' : plan.tier || '' ) + '</span></div>' +
				( plan.state === 'trial' && null !== plan.trial_days_left ? '<div class="meta">' + num( plan.trial_days_left ) + ' day' + ( 1 === Number( plan.trial_days_left ) ? '' : 's' ) + ' left · Solo limits</div>' : '' ) +
				( limit ? '<div class="meta">Events this month</div><div class="silo-meter"><span class="' + ( pct >= 100 ? 'is-rose' : pct >= 80 ? 'is-amber' : '' ) + '" style="width:' + pct.toFixed( 1 ) + '%"></span></div>' +
					'<div class="meta">' + num( used ) + ' / ' + num( limit ) + ' · shared by your stores</div>' : '' ) +
				( plan.warmup_per_event ? '<div class="meta">Warmup ' + num( plan.warmup_per_event ) + ' URLs per change · logs ' + num( plan.log_days ) + ' days</div>' : '' ) +
				( plan.billing_url ? '<a class="silo-link" href="' + esc( plan.billing_url ) + '" target="_blank" rel="noopener noreferrer">Billing and plans</a>' : '' ) +
				'</div>'
			: '';

		const views = { overview: overviewView, catalog: catalogView, invalidations: invalidationsView, warmup: warmupView, status: statusView, settings: settingsView };
		const animate = S.renderedView !== S.view;
		S.renderedView = S.view;

		return (
			'<div class="silo-body"><aside class="silo-side"><nav class="silo-nav" aria-label="Silo">' + nav + '</nav>' + keycard + planCard + '</aside>' +
			'<main class="silo-main"' + ( animate ? '' : ' style="animation:none"' ) + '>' + planBanner + banner + ( S.pollError ? '<div class="silo-error" style="margin:0 0 14px">' + esc( S.pollError ) + '</div>' : '' ) + views[ S.view ]() + '</main></div>'
		);
	}

	function head( title, sub, actions ) {
		return '<div class="silo-page-head"><div><h1>' + esc( title ) + '</h1><p class="sub">' + sub + '</p></div><div class="silo-actions">' + ( actions || '' ) + '</div></div>';
	}

	function purgeButton() {
		if ( 'purge' === S.confirm ) {
			return '<span class="silo-confirm">Purge every cached page and reset stats?<button type="button" class="silo-btn is-amber" data-act="confirm-purge">' + ( 'purge' === S.busy ? '<span class="silo-spin"></span>' : 'Purge' ) + '</button><button type="button" class="silo-link" data-act="cancel">Cancel</button></span>';
		}
		return '<button type="button" class="silo-btn is-amber" data-act="purge">' + icon( 'trash' ) + 'Purge all</button>';
	}

	function openInSilo() {
		return S.state.dashboard ? '<a class="silo-btn" href="' + esc( S.state.dashboard ) + '" target="_blank" rel="noopener">Open in Silo ' + icon( 'external' ) + '</a>' : '';
	}

	function healthPills() {
		const st = S.state;
		const env = st.env || {};
		const set = st.settings || {};
		const pills = [];
		const age = st.heartbeat && st.heartbeat.ok ? ( st.now || 0 ) - st.heartbeat.ok : null;

		if ( env.auth_error ) {
			pills.push( '<span class="silo-pill is-rose"><span class="silo-dot"></span>' + esc( env.auth_error ) + '</span>' );
		} else if ( null !== age && age < 150 ) {
			pills.push( '<span class="silo-pill is-mint"><span class="silo-pulse"></span>Synced with Silo · ' + esc( ago( st.heartbeat.ok ) ) + '</span>' );
		} else {
			pills.push( '<span class="silo-pill is-amber"><span class="silo-dot"></span>' + esc( ( st.heartbeat && st.heartbeat.error ) || 'Waiting for heartbeat' ) + '</span>' );
		}

		if ( ! set.page_cache ) {
			pills.push( '<span class="silo-pill is-rose"><span class="silo-dot"></span>Page cache off</span>' );
		} else if ( 'coexist' === env.cache_mode ) {
			pills.push( '<span class="silo-pill is-mint"><span class="silo-dot"></span>Working alongside ' + esc( env.owner || 'another page cache' ) + '</span>' );
		} else if ( 'dropin' === env.mode ) {
			pills.push( '<span class="silo-pill is-mint"><span class="silo-dot"></span>Serving before WordPress loads</span>' );
		} else {
			pills.push( '<span class="silo-pill is-amber"><span class="silo-dot"></span>Late serve mode</span>' );
		}

		pills.push( set.store_api_cache ? '<span class="silo-pill"><span class="silo-dot silo-mint"></span>Store API cache</span>' : '<span class="silo-pill">Store API cache off</span>' );

		if ( 'silo' === env.cache_mode ) {
			( env.conflicts || [] ).forEach( ( c ) => pills.push( '<span class="silo-pill is-amber"><span class="silo-dot"></span>' + esc( c ) + ' also caches pages</span>' ) );
		}

		if ( st.queued ) {
			pills.push( '<span class="silo-pill is-accent"><span class="silo-pulse"></span>' + num( st.queued ) + ' event' + ( 1 === st.queued ? '' : 's' ) + ' sending</span>' );
		}
		return '<div class="silo-health">' + pills.join( '' ) + '</div>';
	}

	/* Overview ----------------------------------------------------------- */

	function overviewView() {
		const st = S.state;
		const s = st.stats || {};
		const e24 = st.events24 || {};
		const w = ( st.warmup && st.warmup.counts ) || {};
		const inv = st.inventory || {};
		const faster = s.avg_hit_ms && s.avg_miss_ms ? Math.max( 0, Math.round( ( 1 - s.avg_hit_ms / s.avg_miss_ms ) * 100 ) ) : 0;

		const kpis =
			'<div class="silo-grid cols-4" style="margin-top:0">' +
			kpi( 'Hit rate', tw( 'k-hit', s.hit_rate, 1 ) + '<small>%</small>', num( s.hits ) + ' hits · ' + num( s.misses ) + ' misses', s.hits ? 'is-mint' : '' ) +
			kpi( 'Avg response', s.avg_hit_ms ? tw( 'k-ms', s.avg_hit_ms ) + '<small>ms</small>' : '—', s.avg_miss_ms ? 'origin ' + ms( s.avg_miss_ms ) + ( faster ? ' · ' + faster + '% faster' : '' ) : 'measured on cache hits', faster ? 'is-mint' : '' ) +
			kpi( 'Invalidations', tw( 'k-inv', e24.events ), 'last 24h · ' + num( e24.purged ) + ' URLs' + ( e24.avg_ms ? ' · ' + ms( e24.avg_ms ) + ' avg' : '' ), '' ) +
			kpi( 'Warmup queue', tw( 'k-warm', ( w.queued || 0 ) + ( w.warming || 0 ) ), num( w.warming ) + ' warming · ' + num( w.warm_24h ) + ' warmed 24h', ( w.queued || w.warming ) ? 'is-amber' : '' ) +
			'</div>';

		const recentEvents = ( st.events || [] ).slice( 0, 8 );

		return (
			head( 'Overview', esc( ( st.site && st.site.host ) || '' ) + ' · live · stats since ' + esc( s.since ? new Date( s.since * 1000 ).toLocaleString() : '—' ), purgeButton() + openInSilo() ) +
			healthPills() +
			kpis +
			latestCard( ( st.events || [] ).find( ( e ) => 0 !== e.type.indexOf( 'system.' ) ) ) +
			'<div class="silo-grid cols-2">' + trafficCard() + warmupCard( 6 ) + '</div>' +
			'<div class="silo-card silo-mt"><div class="silo-card-head"><h3>Recent invalidations</h3><span class="meta">live log · <button type="button" class="silo-link" data-act="nav" data-view="invalidations">view all</button></span></div>' + eventTable( recentEvents ) + '</div>' +
			'<div class="silo-grid cols-3">' +
			byTypeCard( s ) +
			sessionCard( s ) +
			'<div class="silo-card"><div class="silo-card-head"><h3>Cache inventory</h3><span class="meta">' + esc( bytes( inv.bytes ) ) + '</span></div>' +
			'<p class="silo-hint">What is stored on disk right now.</p>' +
			'<div class="silo-rows"><div class="silo-row"><span class="k">Cached pages</span><span class="v">' + tw( 'k-pages', inv.pages ) + '</span></div>' +
			'<div class="silo-row"><span class="k">Store API filter sets</span><span class="v">' + tw( 'k-api', inv.api ) + '</span></div>' +
			'<div class="silo-row"><span class="k">Store API hit rate</span><span class="v">' + esc( ( s.api_hit_rate || 0 ).toFixed( 1 ) ) + '%</span></div>' +
			'<div class="silo-row"><span class="k">Cart fragments from cache</span><span class="v">' + tw( 'k-frag', s.fragment_hits || 0 ) + '</span></div>' +
			'<div class="silo-row"><span class="k">Last heartbeat</span><span class="v">' + esc( ago( st.heartbeat && st.heartbeat.ok ) ) + '</span></div></div></div>' +
			'</div>'
		);
	}

	function latestCard( e ) {
		if ( ! e ) {
			return '<div class="silo-card silo-mt silo-latest"><div class="silo-latest-head"><span class="silo-zap">' + icon( 'invalidations' ) + '</span><span class="trigger">waiting for the first catalog event</span></div>' +
				'<p class="silo-hint" style="margin-top:10px">Change a price or stock level in WooCommerce. The event, the pages it cleared and the re-warm appear here within seconds.</p></div>';
		}
		const total = ( ( S.state.scan && S.state.scan.counts ) || {} ).nodes || 0;
		const full = 'purge.all' === e.type;
		const chain = full ? [ 'entire cache' ] : [ 'product page', e.purged > 1 ? ( e.purged - 1 ) + ' related URLs' : '', 'Store API' ].filter( Boolean );
		return (
			'<div class="silo-card silo-mt silo-latest">' +
			'<div class="silo-latest-head"><span class="silo-zap">' + icon( 'invalidations' ) + '</span><span class="trigger">' + esc( e.type ) + '</span>' +
			'<span class="sku">' + esc( e.detail ) + '</span><span class="when">' + esc( ago( e.created_at ) ) + '</span><span class="ms">' + esc( e.duration_ms ? ms( e.duration_ms ) : e.local_ms ? ms( e.local_ms ) : '—' ) + '</span></div>' +
			'<div class="silo-latest-object">' + esc( e.object ) + '</div>' +
			'<div class="silo-chain">' + chain.map( ( n, i ) => ( i ? '<span class="arr">' + icon( 'arrow' ) + '</span>' : '' ) + '<span class="node">' + esc( n ) + '</span>' ).join( '' ) + '<span class="end">' + stateChip( e.state ) + '</span></div>' +
			'<div class="silo-latest-foot"><span>' + ( e.warm_total ? num( e.warm_total ) + ' priority pages re-warming' : num( e.purged ) + ' URLs purged' ) + '</span>' +
			( total && ! full ? '<span>' + num( Math.max( 0, total - e.purged ) ) + ' catalog nodes untouched</span>' : '' ) + '</div></div>'
		);
	}

	function byTypeCard( s ) {
		const labels = { product: 'Product pages', archive: 'Category & tag archives', shop: 'Shop page', front: 'Front page' };
		const types = s.by_type || {};
		const rows = Object.keys( labels )
			.filter( ( k ) => types[ k ] )
			.map( ( k ) => '<div class="silo-typebar"><span class="name">' + labels[ k ] + '</span><div class="silo-bar is-mint"><i style="width:' + types[ k ].hit_rate + '%"></i></div><span class="n">' + Number( types[ k ].hit_rate ).toFixed( 1 ) + '%</span></div>' )
			.join( '' );
		return '<div class="silo-card"><div class="silo-card-head"><h3>Hit rate by page type</h3></div><p class="silo-hint">Share of anonymous requests served from cache, per WooCommerce page type.</p>' +
			( rows || '<div class="silo-empty" style="min-height:80px">No storefront traffic yet.</div>' ) + '</div>';
	}

	function sessionCard( s ) {
		const labels = { cart: 'Cart in progress', session: 'WooCommerce session', logged_in: 'Logged-in customer', authorization: 'Authorization header', password: 'Password-protected', commenter: 'Commenter cookie' };
		const reasons = s.bypass_reasons || {};
		const rows = Object.keys( reasons ).slice( 0, 5 ).map( ( k ) => row( labels[ k ] || k, num( reasons[ k ] ) ) ).join( '' );
		return '<div class="silo-card"><div class="silo-card-head"><h3>Session boundary</h3><span class="silo-chip is-mint">0 shared</span></div>' +
			'<p class="silo-hint">Requests that depend on who is asking go straight to WooCommerce. They are never stored or shared.</p>' +
			'<div class="silo-kpi" style="border:0;padding:0;background:none"><div class="value">' + tw( 'k-bypass', s.bypass ) + '<small>bypassed</small></div></div>' +
			'<div class="silo-rows silo-mt">' + ( rows || row( 'No personalised requests yet', '—' ) ) + '</div></div>';
	}

	function kpi( label, value, delta, tone ) {
		return '<div class="silo-kpi"><div class="label">' + esc( label ) + '</div><div class="value">' + value + '</div><div class="delta ' + ( tone || '' ) + '">' + esc( delta ) + '</div></div>';
	}

	function trafficCard() {
		const series = S.series;
		const total = series.reduce( ( a, p ) => a + p.h + p.m + p.b, 0 );
		const max = Math.max( 4, ...series.map( ( p ) => p.h + p.m + p.b ) );
		const W = 600;
		const H = 150;
		const slot = W / SERIES_LEN;
		const bw = Math.max( 3, slot - 4 );
		let bars = '';
		series.forEach( ( p, i ) => {
			const x = i * slot + ( slot - bw ) / 2;
			let y = H;
			[ [ p.h, '#3d6bff' ], [ p.m, 'rgba(244,166,58,.85)' ], [ p.b, 'rgba(255,255,255,.22)' ] ].forEach( ( seg ) => {
				if ( ! seg[ 0 ] ) {
					return;
				}
				const h = Math.max( 2, ( seg[ 0 ] / max ) * ( H - 8 ) );
				y -= h;
				bars += '<rect x="' + x.toFixed( 1 ) + '" y="' + y.toFixed( 1 ) + '" width="' + bw.toFixed( 1 ) + '" height="' + h.toFixed( 1 ) + '" rx="2" fill="' + seg[ 1 ] + '"/>';
			} );
			if ( y === H ) {
				bars += '<rect x="' + x.toFixed( 1 ) + '" y="' + ( H - 2 ) + '" width="' + bw.toFixed( 1 ) + '" height="2" rx="1" fill="rgba(255,255,255,.06)"/>';
			}
		} );
		const grid = [ 0.25, 0.5, 0.75 ].map( ( f ) => '<line x1="0" x2="' + W + '" y1="' + ( H * f ).toFixed( 0 ) + '" y2="' + ( H * f ).toFixed( 0 ) + '" stroke="rgba(255,255,255,.045)"/>' ).join( '' );

		const last = series.slice( -20 );
		const perMin = last.reduce( ( a, p ) => a + p.h + p.m + p.b, 0 );
		const liveServed = last.reduce( ( a, p ) => a + p.h + p.m, 0 );
		const liveHit = liveServed ? ( last.reduce( ( a, p ) => a + p.h, 0 ) / liveServed ) * 100 : 0;

		return (
			'<div class="silo-card silo-traffic"><div class="silo-card-head"><h3>Live traffic</h3>' +
			'<div class="silo-legend"><span><i style="background:#3d6bff"></i>hit</span><span><i style="background:#f4a63a"></i>miss</span><span><i style="background:rgba(255,255,255,.3)"></i>bypass</span></div></div>' +
			'<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Storefront requests per ' + POLL_MS / 1000 + ' seconds">' + grid + bars + '</svg>' +
			'<div class="silo-traffic-foot"><span>' + ( total ? num( perMin ) + ' requests in the last minute' : 'Waiting for storefront traffic — open a product page in a private window' ) + '</span>' +
			'<span>' + ( liveServed ? 'live hit rate ' + liveHit.toFixed( 1 ) + '%' : 'updates every ' + POLL_MS / 1000 + 's' ) + '</span></div></div>'
		);
	}

	function warmupCard( limit ) {
		const wu = S.state.warmup || { active: [], recent: [], counts: {} };
		const active = ( wu.active || [] ).slice( 0, limit );
		const recent = ( wu.recent || [] ).slice( 0, Math.max( 0, limit - active.length ) );
		let rows = '';
		active.forEach( ( r ) => {
			const warming = 'warming' === r.status;
			rows +=
				'<div class="silo-warm-row"><div class="silo-warm-line"><span class="path" title="' + esc( r.url ) + '">' + esc( pathOf( r.url ) ) + '</span>' +
				'<span class="ms">' + ( warming ? 'warming' : 'queued' ) + '</span></div>' +
				'<div class="silo-bar' + ( warming ? ' is-indeterminate' : '' ) + '"><i style="width:' + ( warming ? 38 : 0 ) + '%"></i></div></div>';
		} );
		recent.forEach( ( r ) => {
			const tone = 'warm' === r.status ? 'is-mint' : 'failed' === r.status ? 'is-amber' : '';
			rows +=
				'<div class="silo-warm-row"><div class="silo-warm-line"><span class="path" title="' + esc( r.url ) + '">' + esc( pathOf( r.url ) ) + '</span>' +
				'<span class="ms">' + ( 'warm' === r.status ? ms( r.ms ) : esc( r.error || r.status ) ) + '</span></div>' +
				'<div class="silo-bar ' + tone + '"><i style="width:100%"></i></div></div>';
		} );
		const c = wu.counts || {};
		return (
			'<div class="silo-card"><div class="silo-card-head"><h3>Warmup queue</h3><span class="meta ' + ( c.queued || c.warming ? 'silo-amber' : '' ) + '">' + ( c.queued || c.warming ? num( ( c.queued || 0 ) + ( c.warming || 0 ) ) + ' active' : 'idle' ) + '</span></div>' +
			( rows || '<div class="silo-empty"><strong>Queue is empty</strong>Silo re-warms priority pages right after every invalidation.</div>' ) +
			'<div class="silo-traffic-foot"><span>' + ( c.avg_ms ? 'avg ' + ms( c.avg_ms ) + ' / URL' : 'desktop + mobile per URL' ) + '</span><span>' + num( ( S.state.settings || {} ).warmup_concurrency ) + ' workers</span></div></div>'
		);
	}

	/* Catalog ------------------------------------------------------------ */

	function catalogView() {
		const st = S.state;
		const scan = st.scan || {};
		const c = scan.counts || {};
		const cfgp = st.config || {};
		const types = scan.types || {};
		const maxType = Math.max( 1, ...Object.values( types ) );
		const env = scan.env || {};

		const typeRows = Object.keys( types )
			.sort( ( a, b ) => types[ b ] - types[ a ] )
			.map( ( t ) => '<div class="silo-typebar"><span class="name">' + esc( t.replace( /-/g, ' ' ) ) + '</span><div class="silo-bar"><i style="width:' + ( ( types[ t ] / maxType ) * 100 ).toFixed( 1 ) + '%"></i></div><span class="n">' + num( types[ t ] ) + '</span></div>' )
			.join( '' );

		const stock = scan.stock || {};
		const vstock = scan.variation_stock || {};
		const tax = scan.taxonomies || {};
		const taxRows = Object.keys( tax )
			.map( ( k ) => '<tr><td>' + esc( tax[ k ].label ) + '</td><td class="path">' + esc( k ) + '</td><td class="num">' + num( tax[ k ].terms ) + '</td><td class="num">' + num( tax[ k ].archives ) + '</td><td class="right">' + ( tax[ k ].public ? '<span class="silo-chip is-mint">public</span>' : '<span class="silo-chip">not public</span>' ) + '</td></tr>' )
			.join( '' );

		const ttl = cfgp.ttl || {};
		const ttlText = ( v ) => ( v >= 3600 ? ( v / 3600 ).toFixed( v % 3600 ? 1 : 0 ) + 'h' : Math.round( ( v || 0 ) / 60 ) + 'm' );
		const caps = [];
		caps.push( env.hpos ? '<span class="silo-chip is-mint">HPOS</span>' : '<span class="silo-chip">Legacy orders</span>' );
		if ( ( env.languages || [] ).length > 1 ) {
			caps.push( '<span class="silo-chip is-accent">Languages: ' + esc( env.languages.join( ', ' ) ) + '</span>' );
		}
		if ( ( env.currencies || [] ).length > 1 ) {
			caps.push( '<span class="silo-chip is-accent">Currencies: ' + esc( env.currencies.join( ', ' ) ) + '</span>' );
		}
		( env.conflicts || [] ).forEach( ( x ) => caps.push( '<span class="silo-chip">' + esc( x ) + ' · working alongside</span>' ) );
		if ( false === env.pretty ) {
			caps.push( '<span class="silo-chip is-rose">Plain permalinks</span>' );
		}

		const running = 'running' === scan.status;

		return (
			head( 'Catalog', 'Last scan ' + esc( scan.finished_at ? new Date( scan.finished_at * 1000 ).toLocaleString() : 'never' ) + ( env.wc ? ' · WooCommerce ' + esc( env.wc ) : '' ), '<button type="button" class="silo-btn" data-act="rescan"' + ( running ? ' disabled' : '' ) + '>' + icon( 'refresh' ) + ( running ? 'Scanning ' + num( scan.percent ) + '%' : 'Rescan catalog' ) + '</button>' ) +
			( 'failed' === scan.status ? '<div class="silo-error" style="margin:0 0 14px">Last scan failed: ' + esc( scan.error ) + '</div>' : '' ) +
			'<div class="silo-grid cols-5" style="margin-top:0">' +
			stat( 'Products', c.products, 'published' ) +
			stat( 'Variations', c.variations, 'own cache nodes' ) +
			stat( 'Archives', c.archives, 'resolved' ) +
			stat( 'Store API routes', c.routes, 'cacheable' ) +
			stat( 'Graph nodes', c.nodes, num( c.edges ) + ' edges' ) +
			'</div>' +
			'<div class="silo-grid cols-2e">' +
			'<div class="silo-card"><div class="silo-card-head"><h3>Product types</h3><span class="meta">every registered type</span></div>' + ( typeRows || '<div class="silo-empty">No products mapped yet.</div>' ) + '</div>' +
			'<div class="silo-card"><div class="silo-card-head"><h3>Stock</h3><span class="meta">' + num( stock.managed ) + ' products manage stock</span></div>' +
			'<div class="silo-rows">' +
			row( 'Products in stock', num( stock.instock ) ) +
			row( 'Products out of stock', num( stock.outofstock ) ) +
			row( 'Products on backorder', num( stock.onbackorder ) ) +
			row( 'Variations in stock', num( vstock.instock ) ) +
			row( 'Variations out of stock', num( vstock.outofstock ) ) +
			row( 'Variations on backorder', num( vstock.onbackorder ) ) +
			'</div></div></div>' +
			'<div class="silo-card silo-mt"><div class="silo-card-head"><h3>Taxonomies &amp; archives</h3><span class="meta">categories, tags, brands, attributes</span></div>' +
			'<div class="silo-table-wrap"><table class="silo-table"><thead><tr><th>Taxonomy</th><th>Key</th><th>Terms</th><th>Archives</th><th class="right">Visibility</th></tr></thead><tbody>' +
			( taxRows || '<tr><td colspan="5"><div class="silo-empty">Run a scan to resolve archives.</div></td></tr>' ) +
			'</tbody></table></div></div>' +
			'<div class="silo-grid cols-2e">' +
			'<div class="silo-card"><div class="silo-card-head"><h3>Detected capabilities</h3></div><div class="silo-types" style="margin-top:0">' + caps.join( '' ) + '</div></div>' +
			'<div class="silo-card"><div class="silo-card-head"><h3>Active cache profile</h3><span class="silo-chip">v' + esc( cfgp.version || 0 ) + '</span></div>' +
			'<div class="silo-rows">' +
			row( 'Plan', esc( cfgp.tier || '—' ) ) +
			row( 'TTL product · category · shop', esc( ttlText( ttl.product ) + ' · ' + ttlText( ttl.category ) + ' · ' + ttlText( ttl.shop ) ) ) +
			row( 'Store API TTL', esc( ttlText( ttl.store_api ) ) ) +
			row( 'Warmup URLs per event', num( ( cfgp.limits || {} ).warmup_urls_per_event ) ) +
			row( 'Priority URLs', num( c.priority ) ) +
			'</div></div></div>'
		);
	}

	function stat( label, value, hint ) {
		return '<div class="silo-stat"><div class="label">' + esc( label ) + '</div><div class="value">' + tw( 'st-' + label, value ) + '</div><div class="hint">' + esc( hint ) + '</div></div>';
	}

	function row( k, v ) {
		return '<div class="silo-row"><span class="k">' + esc( k ) + '</span><span class="v">' + v + '</span></div>';
	}

	/* Invalidations ------------------------------------------------------ */

	function invalidationsView() {
		const st = S.state;
		const e24 = st.events24 || {};
		const groups = [ [ '', 'All' ], [ 'stock', 'Stock & orders' ], [ 'price', 'Price & sales' ], [ 'product', 'Products' ], [ 'terms', 'Categories & attributes' ], [ 'system', 'System' ] ];
		let events = S.filter ? S.filtered || [] : st.events || [];
		if ( S.more && ! S.filter ) {
			events = events.concat( S.more.filter( ( e ) => ! events.some( ( x ) => x.id === e.id ) ) );
		}

		return (
			head( 'Invalidations', 'Every catalog change, what was purged, what Silo resolved and what was re-warmed', exportButton( 'events' ) ) +
			'<div class="silo-grid cols-4" style="margin-top:0">' +
			kpi( 'Events (24h)', tw( 'i-ev', e24.events ), 'accepted catalog changes', '' ) +
			kpi( 'URLs purged', tw( 'i-pu', e24.purged ), 'last 24h', '' ) +
			kpi( 'URLs re-warmed', tw( 'i-wa', e24.warmed ), 'last 24h', 'is-mint' ) +
			kpi( 'Avg resolution', e24.avg_ms ? tw( 'i-ms', e24.avg_ms ) + '<small>ms</small>' : '—', 'graph walk in Silo', '' ) +
			'</div>' +
			'<div class="silo-card silo-mt"><div class="silo-card-head"><div class="silo-filter">' +
			groups.map( ( g ) => '<button type="button" class="' + ( g[ 0 ] === S.filter ? 'is-active' : '' ) + '" data-act="filter" data-group="' + g[ 0 ] + '">' + g[ 1 ] + '</button>' ).join( '' ) +
			'</div><span class="meta">' + num( events.length ) + ' shown</span></div>' +
			eventTable( events, { time: true } ) +
			'</div>' +
			( events.length >= 25 ? '<p class="silo-mt" style="text-align:center"><button type="button" class="silo-btn" data-act="more">Load older events</button></p>' : '' )
		);
	}

	/* Warmup ------------------------------------------------------------- */

	function warmupView() {
		const wu = S.state.warmup || { active: [], recent: [], counts: {} };
		const c = wu.counts || {};
		const recentRows = ( wu.recent || [] )
			.map( ( r ) => {
				const chip = 'warm' === r.status ? '<span class="silo-chip is-mint">warm</span>' : 'skipped' === r.status ? '<span class="silo-chip">skipped</span>' : '<span class="silo-chip is-rose">failed</span>';
				return (
					'<tr><td class="path" title="' + esc( r.url ) + '">' + esc( pathOf( r.url ) ) + '</td><td>' + chip + '</td><td class="num">' + esc( r.http_code || '—' ) + '</td>' +
					'<td class="num">' + ( r.ms ? ms( r.ms ) : '—' ) + '</td><td class="num">' + ( r.mobile_ms ? ms( r.mobile_ms ) : '—' ) + '</td>' +
					'<td class="num">' + esc( r.error || r.cache_state || '' ) + '</td><td class="num">' + esc( ago( r.updated_at ) ) + '</td></tr>'
				);
			} )
			.join( '' );

		return (
			head( 'Warmup', 'Silo picks the URLs and the order; the connector fetches them from your server for desktop and mobile', exportButton( 'warmup' ) + '<button type="button" class="silo-btn is-primary" data-act="warm"' + ( 'warm' === S.busy ? ' disabled' : '' ) + '>' + ( 'warm' === S.busy ? '<span class="silo-spin"></span>' : icon( 'flame' ) ) + 'Warm priority pages</button>' ) +
			'<div class="silo-grid cols-5" style="margin-top:0">' +
			stat( 'Queued', c.queued, 'waiting' ) +
			stat( 'Warming', c.warming, 'in flight' ) +
			stat( 'Warmed (24h)', c.warm_24h, 'pages rebuilt' ) +
			stat( 'Failed (24h)', c.failed_24h, 'after one retry' ) +
			stat( 'Avg per URL', c.avg_ms, 'ms · desktop' ) +
			'</div>' +
			'<div class="silo-grid cols-2e">' + warmupCard( 12 ) +
			'<div class="silo-card"><div class="silo-card-head"><h3>How warmup is scheduled</h3></div><div class="silo-rows">' +
			row( 'After every invalidation', 'priority URLs, capped by plan' ) +
			row( 'Stale entries', 'refreshed in the background' ) +
			row( 'Daily priority pass', 'bestsellers, shop, top categories' ) +
			row( 'Concurrency', num( ( S.state.settings || {} ).warmup_concurrency ) + ' URLs × 2 devices' ) +
			row( 'Runs', 'Action Scheduler, never in a shopper request' ) +
			'</div></div></div>' +
			'<div class="silo-card silo-mt"><div class="silo-card-head"><h3>Recent results</h3><span class="meta">last 24 URLs</span></div>' +
			'<div class="silo-table-wrap"><table class="silo-table"><thead><tr><th>URL</th><th>Result</th><th>HTTP</th><th>Desktop</th><th>Mobile</th><th>Note</th><th>When</th></tr></thead><tbody>' +
			( recentRows || '<tr><td colspan="7"><div class="silo-empty">No warmup results yet.</div></td></tr>' ) +
			'</tbody></table></div></div>'
		);
	}

	/* Status ------------------------------------------------------------- */

	function statusView() {
		const checks = S.checks;
		const checkHtml = checks
			? checks.map( ( c ) => '<div class="silo-check"><span class="icon ' + esc( c.state ) + '">' + ( 'ok' === c.state ? '✓' : 'warn' === c.state ? '!' : '✕' ) + '</span><span class="label">' + esc( c.label ) + '</span><span class="detail">' + esc( c.detail ) + '</span></div>' ).join( '' )
			: '<div class="silo-empty"><span class="silo-spin"></span>Running checks…</div>';

		const entries = S.entries;
		let entryRows = '';
		if ( entries && entries.entries ) {
			entryRows = entries.entries
				.slice( 0, 150 )
				.map( ( e ) => {
					const pct = e.ttl ? Math.max( 0, 100 - ( e.age / e.ttl ) * 100 ) : 0;
					return (
						'<tr><td class="path" title="' + esc( e.url ) + '">' + esc( pathOf( e.url ) ) + '</td><td class="num">' + esc( e.scope ) + '</td><td class="num">' + esc( e.device ) + ( e.currency ? ' · ' + esc( e.currency ) : '' ) + '</td>' +
						'<td class="num"><div class="silo-bar ' + ( e.fresh ? 'is-mint' : 'is-amber' ) + '" style="width:70px;display:inline-block;vertical-align:middle;margin:0 8px 0 0"><i style="width:' + pct.toFixed( 0 ) + '%"></i></div>' + esc( ago( Math.floor( Date.now() / 1000 ) - e.age ) ) + '</td>' +
						'<td class="num">' + esc( bytes( e.size ) ) + '</td><td class="num">' + esc( ms( e.render_ms ) ) + '</td></tr>'
					);
				} )
				.join( '' );
		}

		return (
			head( 'Status', 'Connection, drop-in, conflicts and a live cache round trip', exportButton( 'diagnostics', 'Download diagnostics' ) + exportButton( 'cache', 'Export cache list' ) + '<button type="button" class="silo-btn" data-act="checks"' + ( 'checks' === S.busy ? ' disabled' : '' ) + '>' + ( 'checks' === S.busy ? '<span class="silo-spin"></span>' : icon( 'refresh' ) ) + 'Run live checks</button>' ) +
			'<div class="silo-card"><div class="silo-card-head"><h3>Health</h3></div>' + checkHtml + '</div>' +
			'<div class="silo-card silo-mt"><div class="silo-card-head"><h3>Cache inspector</h3><span class="meta">' + ( entries && entries.inventory ? num( entries.inventory.pages ) + ' pages · ' + esc( bytes( entries.inventory.bytes ) ) : '' ) + ' · <button type="button" class="silo-link" data-act="entries">refresh</button></span></div>' +
			( entries
				? '<div class="silo-table-wrap"><table class="silo-table"><thead><tr><th>URL</th><th>Scope</th><th>Variant</th><th>Freshness</th><th>Size</th><th>Render</th></tr></thead><tbody>' +
				  ( entryRows || '<tr><td colspan="6"><div class="silo-empty"><strong>Nothing cached yet</strong>Pages are stored the first time an anonymous shopper (or warmup) requests them.</div></td></tr>' ) +
				  '</tbody></table></div>'
				: '<div class="silo-empty"><span class="silo-spin"></span></div>' ) +
			'</div>'
		);
	}

	/* Settings ----------------------------------------------------------- */

	function settingsView() {
		const st = S.state;
		const set = st.settings || {};
		const store = st.store || {};
		const toggles = [
			[ 'page_cache', 'Page cache', 'Serve product pages, the shop and product archives from disk. Turning this off purges every cached page.' ],
			[ 'store_api_cache', 'Store API cache', 'Cache anonymous catalog responses from /wc/store/v1 (product collections, filters, categories). Cart and checkout routes are never cached.' ],
			[ 'warmup', 'Priority warmup', 'Re-render affected priority pages in the background right after an invalidation, so shoppers never hit a cold page.' ],
			[ 'cache_front_page', 'Cache the front page', 'Include the home page when it shows products. Off by default because many home pages are not catalog pages.' ],
		];

		return (
			head( 'Settings', 'Connection, cache behaviour and danger zone', openInSilo() ) +
			'<div class="silo-grid cols-2e" style="margin-top:0">' +
			'<div class="silo-card"><div class="silo-card-head"><h3>Connection</h3>' + syncPill() + '</div><div class="silo-rows">' +
			row( 'Store', esc( store.name || '—' ) ) +
			row( 'Store URL in Silo', esc( store.url || '—' ) ) +
			row( 'Plan', esc( ( st.config && st.config.tier ) || store.tier || '—' ) ) +
			row( 'Store key', '<span class="code">' + esc( st.key_hint ) + '</span>' ) +
			row( 'Silo service', esc( hostOf( st.saas_url ) ) ) +
			row( 'Connector', 'v' + esc( st.version ) + ' · ' + esc( ( st.env && st.env.cache_mode ) === 'coexist' ? 'working alongside ' + ( st.env.owner || 'another cache' ) : ( ( st.env && st.env.mode ) === 'dropin' ? 'drop-in' : 'late serve' ) ) ) +
			'</div></div>' +
			'<div class="silo-card"><div class="silo-card-head"><h3>Cache behaviour</h3></div>' +
			toggles
				.map(
					( t ) =>
						'<div class="silo-toggle-row"><div><div class="t">' + t[ 1 ] + '</div><div class="d">' + t[ 2 ] + '</div></div>' +
						'<label class="silo-switch"><input type="checkbox" data-setting="' + t[ 0 ] + '"' + ( set[ t[ 0 ] ] ? ' checked' : '' ) + '><span></span><b class="silo-sr">' + t[ 1 ] + '</b></label></div>'
				)
				.join( '' ) +
			'<div class="silo-toggle-row"><div><div class="t">Warmup concurrency</div><div class="d">URLs fetched in parallel (each for desktop and mobile). Lower it if your host rate-limits its own origin.</div></div>' +
			'<div class="silo-range"><input type="range" min="1" max="8" step="1" value="' + esc( set.warmup_concurrency || 4 ) + '" data-setting="warmup_concurrency"><span>' + esc( set.warmup_concurrency || 4 ) + '</span></div></div>' +
			'</div></div>' +
			compatCard() +
			'<div class="silo-card silo-danger silo-mt"><div class="silo-card-head"><h3>Danger zone</h3></div>' +
			'<div class="silo-toggle-row"><div><div class="t">Purge all</div><div class="d">Remove every cached page and Store API entry and reset statistics on both sides. Priority pages are re-warmed.</div></div>' + purgeButton() + '</div>' +
			'<div class="silo-toggle-row"><div><div class="t">Disconnect</div><div class="d">Forget the store key, stop caching and purge cached pages. The store stays in your Silo account.</div></div>' +
			( 'disconnect' === S.confirm
				? '<span class="silo-confirm">Disconnect and stop caching?<button type="button" class="silo-btn is-rose" data-act="confirm-disconnect">Disconnect</button><button type="button" class="silo-link" data-act="cancel">Cancel</button></span>'
				: '<button type="button" class="silo-btn is-rose" data-act="disconnect">Disconnect</button>' ) +
			'</div></div>'
		);
	}

	function compatCard() {
		const c = S.state.compat || {};
		const cf = S.state.cloudflare || {};
		const setting = ( S.state.settings || {} ).cache_mode || 'auto';
		const owner = c.owner || '';
		const modes = [
			[ 'auto', 'Automatic', owner ? 'Recommended. ' + esc( owner ) + ' is active, so Silo works alongside it.' : 'Recommended. No other page cache found, so Silo serves cached pages itself.' ],
			[ 'coexist', 'Work alongside another cache', 'Your page cache plugin keeps serving pages. Silo purges exactly the right pages in it on every stock, price, sale and order change, then rewarms them. Store API caching stays on.' ],
			[ 'silo', 'Silo serves pages', 'Silo serves cached product, shop and category pages. Turn off any other plugin’s page cache (keep its CSS, JS and image features) so pages are not cached twice.' ],
		];
		const active = 'coexist' === c.mode
			? '<strong>' + esc( owner || 'Another plugin' ) + '</strong> serves cached pages · Silo handles WooCommerce invalidation, warmup and Store API caching'
			: '<strong>Silo</strong> serves cached pages' + ( owner ? ' · ' + esc( owner ) + ' is also active' : '' );
		const edge = ( c.edge || [] ).length ? esc( c.edge.join( ', ' ) ) : 'none detected';

		return (
			'<div class="silo-card silo-mt"><div class="silo-card-head"><h3>Other caches and CDN</h3></div>' +
			'<p class="silo-note">Silo is built to run alongside WP Rocket, LiteSpeed, W3 Total Cache, host caches, Cloudflare and page builders such as Elementor. Keep them installed.</p>' +
			'<div class="silo-rows">' +
			row( 'Right now', active ) +
			row( 'Purged in step', edge ) +
			'</div>' +
			'<fieldset class="silo-modes"><legend class="silo-sr">How pages are served</legend>' +
			modes
				.map(
					( m ) =>
						'<label class="silo-mode' + ( setting === m[ 0 ] ? ' is-on' : '' ) + '"><input type="radio" name="cache_mode" value="' + m[ 0 ] + '"' + ( setting === m[ 0 ] ? ' checked' : '' ) + '>' +
						'<span><span class="t">' + m[ 1 ] + '</span><span class="d">' + m[ 2 ] + '</span></span></label>'
				)
				.join( '' ) +
			'</fieldset>' +
			'<form class="silo-cf" data-form="cloudflare" autocomplete="off">' +
			'<div class="t">Cloudflare</div>' +
			'<div class="d">' + ( cf.zone ? 'Connected' + ( cf.name ? ' to <strong>' + esc( cf.name ) + '</strong>' : '' ) + '. Cloudflare copies of changed pages are purged with Silo’s.' : 'Using Cloudflare caching (APO or cache rules)? Add a zone ID and an API token with the Zone → Cache Purge permission so its copies are purged in step.' ) + '</div>' +
			'<div class="silo-cf-grid">' +
			'<div class="silo-field"><label for="silo-cf-zone">Zone ID</label><input id="silo-cf-zone" type="text" name="zone" spellcheck="false" value="' + esc( cf.zone || '' ) + '" placeholder="32-character zone ID"></div>' +
			'<div class="silo-field"><label for="silo-cf-token">API token</label><input id="silo-cf-token" type="password" name="token" spellcheck="false" value="" placeholder="' + ( cf.has_token ? 'Saved — leave blank to keep' : 'Token with Cache Purge permission' ) + '"></div>' +
			'</div>' +
			'<div class="silo-cf-actions"><button type="submit" class="silo-btn">' + ( cf.zone ? 'Update' : 'Connect Cloudflare' ) + '</button>' +
			( cf.zone ? '<button type="button" class="silo-link" data-act="cf-remove">Remove</button>' : '' ) + '</div>' +
			'</form></div>'
		);
	}

	async function saveCloudflare( zone, token ) {
		try {
			ingest( await api( 'save_cloudflare', { zone, token } ) );
			toast( zone ? 'Cloudflare connected' : 'Cloudflare removed' );
		} catch ( e ) {
			toast( e.message, 'error' );
		}
		render();
	}

	/* ------------------------------------------------------------------ */
	/* Render + interactions                                               */
	/* ------------------------------------------------------------------ */

	function render() {
		const terminal = root.querySelector( '[data-terminal]' );
		const stick = terminal ? terminal.scrollTop + terminal.clientHeight >= terminal.scrollHeight - 8 : true;

		let body;
		if ( ! S.state.connected ) {
			body = connectView();
		} else if ( showScan() ) {
			body = scanView();
		} else {
			body = shell();
		}
		root.innerHTML = topbar() + body;

		const newTerminal = root.querySelector( '[data-terminal]' );
		if ( newTerminal && stick ) {
			newTerminal.scrollTop = newTerminal.scrollHeight;
		}
		runTweens();
	}

	function runTweens() {
		root.querySelectorAll( '[data-tw]' ).forEach( ( el ) => {
			const key = el.getAttribute( 'data-tw' );
			const to = Number( el.getAttribute( 'data-to' ) );
			const dec = Number( el.getAttribute( 'data-dec' ) );
			const suf = el.getAttribute( 'data-suf' ) || '';
			const from = Object.prototype.hasOwnProperty.call( S.tweens, key ) ? S.tweens[ key ] : 0;
			S.tweens[ key ] = to;
			if ( from === to || window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) {
				return;
			}
			const start = performance.now();
			const dur = 750;
			const fmt = ( v ) => v.toLocaleString( undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec } ) + suf;
			const step = ( now ) => {
				const p = Math.min( 1, ( now - start ) / dur );
				const eased = 1 - Math.pow( 1 - p, 3 );
				el.textContent = fmt( from + ( to - from ) * eased );
				if ( p < 1 && el.isConnected ) {
					requestAnimationFrame( step );
				}
			};
			requestAnimationFrame( step );
		} );
	}

	async function act( name, el ) {
		switch ( name ) {
			case 'cf-remove':
				saveCloudflare( '', '' );
				break;
			case 'nav':
				S.view = el.getAttribute( 'data-view' );
				S.confirm = '';
				history.replaceState( null, '', '#' + S.view );
				if ( 'status' === S.view ) {
					loadStatus();
				}
				render();
				window.scrollTo( 0, 0 );
				return;
			case 'export':
				exportData( el.getAttribute( 'data-kind' ) );
				return;
			case 'advanced':
				S.advanced = true;
				render();
				return;
			case 'toggle-row': {
				const id = Number( el.getAttribute( 'data-id' ) );
				if ( Object.prototype.hasOwnProperty.call( S.expanded, id ) ) {
					delete S.expanded[ id ];
					render();
					return;
				}
				S.expanded[ id ] = null;
				render();
				try {
					S.expanded[ id ] = await api( 'event', { id } );
				} catch ( e ) {
					delete S.expanded[ id ];
					toast( e.message, 'error' );
				}
				render();
				return;
			}
			case 'purge':
			case 'disconnect':
				S.confirm = name;
				render();
				return;
			case 'cancel':
				S.confirm = '';
				render();
				return;
			case 'confirm-purge':
				S.busy = 'purge';
				render();
				try {
					const res = await api( 'purge_all' );
					S.prev = null;
					S.series = Array.from( { length: SERIES_LEN }, () => ( { h: 0, m: 0, b: 0 } ) );
					ingest( res.state );
					S.entries = null;
					toast( 'Purged ' + num( res.purged ) + ' cached entries · stats reset on both sides' );
				} catch ( e ) {
					toast( e.message, 'error' );
				}
				S.busy = '';
				S.confirm = '';
				render();
				return;
			case 'confirm-disconnect':
				try {
					ingest( await api( 'disconnect' ) );
					S.scanView = false;
					toast( 'Disconnected. Caching is off.' );
				} catch ( e ) {
					toast( e.message, 'error' );
				}
				S.confirm = '';
				render();
				return;
			case 'rescan':
				try {
					S.state.scan = await api( 'scan_start' );
					S.scanView = true;
					S.scanHidden = false;
					S.nodesOn = 0;
					render();
					driveScan();
				} catch ( e ) {
					toast( e.message, 'error' );
				}
				return;
			case 'show-scan':
				S.scanHidden = false;
				S.scanView = true;
				render();
				return;
			case 'hide-scan':
				S.scanHidden = true;
				S.scanView = false;
				render();
				return;
			case 'open-overview':
				S.scanView = false;
				S.view = 'overview';
				history.replaceState( null, '', '#overview' );
				render();
				window.scrollTo( 0, 0 );
				return;
			case 'warm':
				S.busy = 'warm';
				render();
				try {
					const res = await api( 'warm_priority' );
					ingest( res.state );
					toast( res.queued ? 'Queued ' + num( res.queued ) + ' priority URLs for warmup' : 'Priority pages are already queued' );
				} catch ( e ) {
					toast( e.message, 'error' );
				}
				S.busy = '';
				render();
				return;
			case 'checks':
				S.busy = 'checks';
				S.checks = null;
				render();
				await loadChecks();
				S.busy = '';
				render();
				return;
			case 'entries':
				S.entries = null;
				render();
				await loadEntries();
				render();
				return;
			case 'filter':
				S.filter = el.getAttribute( 'data-group' ) || '';
				S.filtered = null;
				S.more = null;
				render();
				if ( S.filter ) {
					try {
						S.filtered = await api( 'events', { group: S.filter } );
					} catch ( e ) {
						toast( e.message, 'error' );
					}
					render();
				}
				return;
			case 'more': {
				const list = S.filter ? S.filtered || [] : ( S.state.events || [] ).concat( S.more || [] );
				const last = list.length ? list[ list.length - 1 ].id : 0;
				try {
					const older = await api( 'events', { group: S.filter, before: last } );
					if ( S.filter ) {
						S.filtered = ( S.filtered || [] ).concat( older );
					} else {
						S.more = ( S.more || [] ).concat( older );
					}
					if ( ! older.length ) {
						toast( 'No older events' );
					}
				} catch ( e ) {
					toast( e.message, 'error' );
				}
				render();
				return;
			}
		}
	}

	async function loadChecks() {
		try {
			S.checks = await api( 'checks' );
		} catch ( e ) {
			S.checks = [ { state: 'fail', label: 'Checks', detail: e.message } ];
		}
	}

	async function loadEntries() {
		try {
			S.entries = await api( 'entries' );
		} catch ( e ) {
			S.entries = { entries: [], inventory: null };
			toast( e.message, 'error' );
		}
	}

	async function loadStatus() {
		const jobs = [];
		if ( ! S.checks ) {
			jobs.push( loadChecks() );
		}
		if ( ! S.entries ) {
			jobs.push( loadEntries() );
		}
		await Promise.all( jobs );
		render();
	}

	async function saveSetting( key, value ) {
		const payload = {};
		payload[ key ] = value;
		try {
			ingest( await api( 'save_settings', { settings: payload } ) );
			toast( 'Saved' );
		} catch ( e ) {
			toast( e.message, 'error' );
		}
		render();
	}

	root.addEventListener( 'click', ( ev ) => {
		const el = ev.target.closest( '[data-act]' );
		if ( ! el || ! root.contains( el ) ) {
			return;
		}
		if ( 'A' !== el.tagName ) {
			ev.preventDefault();
		}
		act( el.getAttribute( 'data-act' ), el );
	} );

	root.addEventListener( 'change', ( ev ) => {
		const el = ev.target;
		if ( ! el.hasAttribute || ! el.hasAttribute( 'data-setting' ) ) {
			return;
		}
		const key = el.getAttribute( 'data-setting' );
		saveSetting( key, 'checkbox' === el.type ? el.checked : Number( el.value ) );
	} );

	root.addEventListener( 'change', ( ev ) => {
		const el = ev.target;
		if ( 'radio' === el.type && 'cache_mode' === el.name ) {
			saveSetting( 'cache_mode', el.value );
		}
	} );

	root.addEventListener( 'input', ( ev ) => {
		const el = ev.target;
		if ( 'range' === el.type && el.nextElementSibling ) {
			el.nextElementSibling.textContent = el.value;
		}
		if ( 'key' === el.name ) {
			S.form.key = el.value;
		}
		if ( 'saas' === el.name ) {
			S.form.saas = el.value;
		}
	} );

	root.addEventListener( 'submit', ( ev ) => {
		const form = ev.target;
		if ( 'connect' === form.getAttribute( 'data-form' ) ) {
			ev.preventDefault();
			doConnect( form );
		}
		if ( 'cloudflare' === form.getAttribute( 'data-form' ) ) {
			ev.preventDefault();
			saveCloudflare( form.zone.value.trim(), form.token.value.trim() );
		}
	} );

	document.addEventListener( 'visibilitychange', () => {
		if ( document.hidden ) {
			clearTimeout( S.timer );
		} else if ( S.state.connected ) {
			poll();
		}
	} );

	/* ------------------------------------------------------------------ */
	/* Boot                                                                */
	/* ------------------------------------------------------------------ */

	ingest( cfg.state || {} );
	render();
	if ( 'status' === S.view && S.state.connected ) {
		loadStatus();
	}
	if ( S.state.connected ) {
		schedule();
		if ( S.state.scan && 'running' === S.state.scan.status ) {
			driveScan();
		}
	}
} )();
