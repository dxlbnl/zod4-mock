<script lang="ts">
	// B103 — Key-Based Field Heuristics, rebuilt on the B100 doc primitives.
	// Prose ported verbatim from docs/key-heuristics.md (the §6 hand-authored
	// convention; parity is human-policed). docs/key-heuristics.md stays canonical.
	//
	// B131 — every former <table> on this page is now an `entries` array rendered
	// by the reusable B121 `DefinitionList` (no <table> in a mobile-first docs
	// site). term = the key(s), value = the generator identifier, description = the
	// description prose (a {#snippet} per entry, preserving inline <code>).
	import DocPage from '$lib/docs/widgets/DocPage.svelte';
	import Playground from '$lib/docs/widgets/Playground.svelte';
	import DefinitionList, {
		type DefinitionEntry
	} from '$lib/docs/widgets/DefinitionList.svelte';

	// A bare z.object(...) expression — the SchemaPlayground DEFAULT_CODE contract
	// (a single valid expression buildExecutable evaluates and auto-generates from).
	const explainCode = `z.object({
  id: z.string(),
  firstName: z.string(),
  email: z.string(),
  homeAddress: z.string(),
  kind: z.string(),
})`;

	// ── How it works: full resolution order (was a 2-col table) ──────────────
	const resolutionEntries: DefinitionEntry[] = [
		{ term: 'matcher:<key>', description: resMatcher },
		{ term: 'key-map:<key>', description: resKeyMap },
		{ term: 'custom:<key>', description: resCustom },
		{ term: '<namespace>.<fn> (exact key)', description: resExact },
		{ term: '<namespace>.<fn> (pattern)', description: resPattern },
		{ term: 'schema-based', description: resSchemaBased }
	];

	// ── Exact-key generators (string) ────────────────────────────────────────
	const personEntries: DefinitionEntry[] = [
		{ term: 'firstname, first_name', value: 'person.firstName', description: pFirstName },
		{ term: 'lastname, last_name, surname', value: 'person.lastName', description: pLastName },
		{ term: 'middlename, middle_name', value: 'person.middleName', description: pMiddleName },
		{ term: 'fullname, full_name, name', value: 'person.fullName', description: pFullName },
		{ term: 'prefix', value: 'person.prefix', description: pPrefix },
		{ term: 'suffix', value: 'person.suffix', description: pSuffix },
		{ term: 'bio', value: 'inline:bio', description: pBio },
		{ term: 'gender', value: 'person.gender', description: pGender },
		{ term: 'sex', value: 'person.sex', description: pSex },
		{ term: 'jobtitle, job_title', value: 'person.jobTitle', description: pJobTitle },
		{ term: 'jobarea, job_area', value: 'person.jobArea', description: pJobArea },
		{ term: 'jobtype, job_type', value: 'person.jobType', description: pJobType }
	];

	const internetEntries: DefinitionEntry[] = [
		{ term: 'email', value: 'internet.email', description: iEmail },
		{ term: 'example_email', value: 'internet.exampleEmail', description: iExampleEmail },
		{ term: 'username', value: 'internet.username', description: iUsername },
		{ term: 'displayname, display_name', value: 'internet.displayName', description: iDisplayName },
		{ term: 'password', value: 'inline:password', description: iPassword },
		{ term: 'url, website, homepage', value: 'internet.url', description: iUrl },
		{ term: 'ip', value: 'internet.ip', description: iIp },
		{ term: 'ipv4', value: 'internet.ipv4', description: iIpv4 },
		{ term: 'ipv6', value: 'internet.ipv6', description: iIpv6 },
		{ term: 'mac', value: 'internet.mac', description: iMac },
		{ term: 'useragent, user_agent', value: 'internet.userAgent', description: iUserAgent },
		{ term: 'protocol', value: 'internet.protocol', description: iProtocol },
		{
			term: 'domain, domainname, domain_name',
			value: 'internet.domainName',
			description: iDomainName
		}
	];

	const locationEntries: DefinitionEntry[] = [
		{ term: 'city', value: 'location.city', description: lCity },
		{ term: 'country', value: 'location.country', description: lCountry },
		{ term: 'countrycode, country_code', value: 'location.countryCode', description: lCountryCode },
		{ term: 'street, streetname, street_name', value: 'location.street', description: lStreet },
		{
			term: 'address, streetaddress, street_address',
			value: 'location.streetAddress',
			description: lStreetAddress
		},
		{
			term: 'zipcode, postalcode, postal_code, postcode',
			value: 'location.zipCode',
			description: lZipCode
		},
		{ term: 'state', value: 'location.state', description: lState },
		{ term: 'county', value: 'location.county', description: lCounty },
		{ term: 'timezone, time_zone', value: 'location.timeZone', description: lTimeZone }
	];

	const financeEntries: DefinitionEntry[] = [
		{ term: 'iban', value: 'finance.iban', description: fIban },
		{ term: 'bic', value: 'finance.bic', description: fBic },
		{
			term: 'accountnumber, account_number',
			value: 'inline:accountnumber',
			description: fAccountNumber
		},
		{
			term: 'creditcard, credit_card, creditcardnumber, credit_card_number',
			value: 'inline:creditcard (and aliases)',
			description: fCreditCard
		},
		{
			term: 'currency, currencycode, currency_code',
			value: 'finance.currencyCode',
			description: fCurrency
		},
		{ term: 'bitcoin', value: 'finance.bitcoinAddress', description: fBitcoin },
		{ term: 'ethereum', value: 'finance.ethereumAddress', description: fEthereum }
	];

	const commerceEntries: DefinitionEntry[] = [
		{ term: 'product', value: 'commerce.product', description: cProduct },
		{ term: 'productname, product_name', value: 'commerce.productName', description: cProductName },
		{ term: 'isbn', value: 'commerce.isbn', description: cIsbn },
		{ term: 'upc', value: 'commerce.upc', description: cUpc },
		{ term: 'department', value: 'commerce.department', description: cDepartment },
		{ term: 'material', value: 'commerce.productMaterial', description: cMaterial },
		{ term: 'price', value: 'inline:price', description: cPrice },
		{ term: 'sku', value: 'inline:sku', description: cSku }
	];

	const companyEntries: DefinitionEntry[] = [
		{ term: 'company, companyname, company_name', value: 'company.name', description: coName },
		{ term: 'buzzword', value: 'company.buzzPhrase', description: coBuzzword },
		{ term: 'catchphrase', value: 'company.catchPhrase', description: coCatchphrase }
	];

	const phoneEntries: DefinitionEntry[] = [
		{ term: 'phone, phonenumber, phone_number', value: 'phone.number', description: phNumber },
		{ term: 'imei', value: 'phone.imei', description: phImei }
	];

	const vehicleEntries: DefinitionEntry[] = [
		{ term: 'vin', value: 'vehicle.vin', description: vVin },
		{ term: 'vrm', value: 'vehicle.vrm', description: vVrm },
		{ term: 'vehicle', value: 'vehicle.vehicle', description: vVehicle },
		{ term: 'manufacturer', value: 'vehicle.manufacturer', description: vManufacturer },
		{ term: 'model', value: 'vehicle.model', description: vModel },
		{ term: 'vehiclecolor, vehicle_color', value: 'vehicle.color', description: vColor },
		{ term: 'fuel', value: 'vehicle.fuel', description: vFuel }
	];

	const colorEntries: DefinitionEntry[] = [
		{ term: 'color, colour', value: 'color.colorName', description: clColor },
		{
			term: 'colorhex, color_hex, hexcolor, hex_color',
			value: 'color.colorHex',
			description: clColorHex
		},
		{
			term: 'backgroundcolor, background_color, textcolor, text_color',
			value: 'color.colorHex',
			description: clBackgroundColor
		}
	];

	const systemEntries: DefinitionEntry[] = [
		{
			term: 'platform, os, operatingsystem, operating_system',
			value: 'system.platform',
			description: sPlatform
		},
		{ term: 'browser', value: 'system.browser', description: sBrowser },
		{ term: 'semver, version', value: 'system.semver', description: sSemver },
		{ term: 'filename, file_name', value: 'system.fileName', description: sFileName },
		{ term: 'filepath, file_path', value: 'system.filePath', description: sFilePath },
		{
			term: 'extension, fileextension, file_extension',
			value: 'system.fileExtension',
			description: sFileExtension
		},
		{
			term: 'mimetype, mime_type, contenttype, content_type',
			value: 'system.mimeType',
			description: sMimeType
		}
	];

	const wordEntries: DefinitionEntry[] = [
		{ term: 'word', value: 'word.noun', description: wWord },
		{
			term: 'text, description, note, summary, comment, body, content, message',
			value: 'inline:<key>',
			description: wText
		}
	];

	// ── Exact-key generators (number) — was a 4-col table; the Distribution
	//    column is folded into the description prose ──────────────────────────
	const numberEntries: DefinitionEntry[] = [
		{ term: 'amount, bedrag', value: 'inline:amount', description: nAmount },
		{ term: 'price, prijs', value: 'inline:price', description: nPrice },
		{ term: 'balance', value: 'inline:balance', description: nBalance },
		{ term: 'total, subtotal', value: 'inline:total', description: nTotal },
		{ term: 'revenue', value: 'inline:revenue', description: nRevenue },
		{ term: 'cost, fee', value: 'inline:cost', description: nCost },
		{ term: 'salary', value: 'inline:salary', description: nSalary },
		{ term: 'fileSize, bytes', value: 'inline:fileSize', description: nFileSize },
		{ term: 'views, population', value: 'inline:views', description: nViews },
		{ term: 'distance', value: 'inline:distance', description: nDistance },
		{ term: 'rating', value: 'inline:rating', description: nRating },
		{ term: 'score, percentage', value: 'inline:score', description: nScore },
		{ term: 'latitude', value: 'location.latitude', description: nLatitude },
		{ term: 'longitude', value: 'location.longitude', description: nLongitude },
		{ term: 'port', value: 'internet.port', description: nPort },
		{ term: 'quantity', value: 'inline:quantity', description: nQuantity },
		{ term: 'count', value: 'inline:count', description: nCount },
		{ term: 'age', value: 'inline:age', description: nAge },
		{ term: 'year', value: 'inline:year', description: nYear }
	];

	// ── Pattern generators ───────────────────────────────────────────────────
	const patternStringEntries: DefinitionEntry[] = [
		{ term: 'string.uuid', description: psUuid },
		{ term: 'person.fullName', description: psName },
		{ term: 'internet.url', description: psUrl },
		{ term: 'internet.email', description: psEmail },
		{ term: 'date.anytime+toISOString', description: psDate }
	];

	const patternDateEntries: DefinitionEntry[] = [{ term: 'date.anytime', description: pdDate }];

	const patternNumberEntries: DefinitionEntry[] = [
		{ term: 'date.anytime+getTime', description: pnDate }
	];

	// ── Localised (Dutch) aliases ─────────────────────────────────────────────
	const dutchStringEntries: DefinitionEntry[] = [
		{ term: 'voornaam', value: 'person.firstName', description: dlVoornaam },
		{ term: 'achternaam', value: 'person.lastName', description: dlAchternaam },
		{ term: 'straat', value: 'location.street', description: dlStraat },
		{ term: 'stad', value: 'location.city', description: dlStad },
		{ term: 'land', value: 'location.country', description: dlLand },
		{ term: 'kenteken', value: 'vehicle.vrm', description: dlKenteken },
		{ term: 'voertuigkleur', value: 'vehicle.color', description: dlVoertuigkleur },
		{ term: 'kleur', value: 'color.colorName', description: dlKleur },
		{ term: 'telefoon', value: 'phone.number', description: dlTelefoon },
		{ term: 'prijs', value: 'inline:prijs', description: dlPrijs },
		{ term: 'omschrijving', value: 'inline:omschrijving', description: dlOmschrijving },
		{ term: 'bericht', value: 'inline:bericht', description: dlBericht }
	];

	const dutchNumberEntries: DefinitionEntry[] = [
		{ term: 'bedrag', value: 'inline:bedrag', description: dnBedrag },
		{ term: 'prijs', value: 'inline:prijs', description: dnPrijs }
	];
</script>

<!-- How it works -->
{#snippet resMatcher()}<strong>1.</strong> Matcher registered via <code>world.withSchema(...)</code
	>.{/snippet}
{#snippet resKeyMap()}<strong>2.</strong> Per-schema key map registered via
	<code>world.withKeyMap(...)</code>.{/snippet}
{#snippet resCustom()}<strong>3.</strong> Custom world-level generator registered via
	<code>world.withGenerators(...)</code>.{/snippet}
{#snippet resExact()}<strong>4.</strong> <strong>Exact-key</strong> entry in
	<code>DEFAULT_KEY_MAP</code> (e.g. <code>person.firstName</code>).{/snippet}
{#snippet resPattern()}<strong>5.</strong> <strong>Pattern</strong> match in
	<code>DEFAULT_KEY_PATTERNS</code> plus a leaf-type suffix for dates.{/snippet}
{#snippet resSchemaBased()}<strong>6.</strong> Schema-based fallback (Zod-introspection).{/snippet}

<!-- Person -->
{#snippet pFirstName()}First name{/snippet}
{#snippet pLastName()}Last name{/snippet}
{#snippet pMiddleName()}Middle name{/snippet}
{#snippet pFullName()}Full name{/snippet}
{#snippet pPrefix()}Honorific prefix (Mr., Dr., …){/snippet}
{#snippet pSuffix()}Name suffix (Jr., III, …){/snippet}
{#snippet pBio()}Lorem text (respects <code>.min()</code>/<code>.max()</code>){/snippet}
{#snippet pGender()}A gender label{/snippet}
{#snippet pSex()}A sex label{/snippet}
{#snippet pJobTitle()}Job title{/snippet}
{#snippet pJobArea()}Job area{/snippet}
{#snippet pJobType()}Job type{/snippet}

<!-- Internet -->
{#snippet iEmail()}Realistic email{/snippet}
{#snippet iExampleEmail()}<code>@example.com</code> email{/snippet}
{#snippet iUsername()}Username{/snippet}
{#snippet iDisplayName()}Display name{/snippet}
{#snippet iPassword()}16-character nanoid{/snippet}
{#snippet iUrl()}HTTPS URL{/snippet}
{#snippet iIp()}IPv4 or IPv6 address{/snippet}
{#snippet iIpv4()}IPv4 address{/snippet}
{#snippet iIpv6()}IPv6 address{/snippet}
{#snippet iMac()}MAC address{/snippet}
{#snippet iUserAgent()}User-Agent string{/snippet}
{#snippet iProtocol()}<code>http</code> / <code>https</code>{/snippet}
{#snippet iDomainName()}Domain name{/snippet}

<!-- Location -->
{#snippet lCity()}City name{/snippet}
{#snippet lCountry()}Country name{/snippet}
{#snippet lCountryCode()}ISO country code{/snippet}
{#snippet lStreet()}Street name{/snippet}
{#snippet lStreetAddress()}Full street address{/snippet}
{#snippet lZipCode()}Postal code{/snippet}
{#snippet lState()}State or region{/snippet}
{#snippet lCounty()}County{/snippet}
{#snippet lTimeZone()}IANA time zone{/snippet}

<!-- Finance -->
{#snippet fIban()}IBAN{/snippet}
{#snippet fBic()}BIC / SWIFT code{/snippet}
{#snippet fAccountNumber()}Bank account number (respects <code>.min()</code>){/snippet}
{#snippet fCreditCard()}Credit-card number{/snippet}
{#snippet fCurrency()}ISO currency code{/snippet}
{#snippet fBitcoin()}Bitcoin address{/snippet}
{#snippet fEthereum()}Ethereum address{/snippet}

<!-- Commerce -->
{#snippet cProduct()}Product noun{/snippet}
{#snippet cProductName()}Product name{/snippet}
{#snippet cIsbn()}ISBN{/snippet}
{#snippet cUpc()}UPC{/snippet}
{#snippet cDepartment()}Retail department{/snippet}
{#snippet cMaterial()}Product material{/snippet}
{#snippet cPrice()}Price string (respects <code>.min()</code>/<code>.max()</code>){/snippet}
{#snippet cSku()}Code like <code>AB-1234</code>{/snippet}

<!-- Company -->
{#snippet coName()}Company name{/snippet}
{#snippet coBuzzword()}Business buzzphrase{/snippet}
{#snippet coCatchphrase()}Marketing catchphrase{/snippet}

<!-- Phone -->
{#snippet phNumber()}Phone number with country code{/snippet}
{#snippet phImei()}IMEI{/snippet}

<!-- Vehicle -->
{#snippet vVin()}Vehicle Identification Number{/snippet}
{#snippet vVrm()}Vehicle Registration Mark (license plate){/snippet}
{#snippet vVehicle()}Vehicle make + model{/snippet}
{#snippet vManufacturer()}Vehicle manufacturer{/snippet}
{#snippet vModel()}Vehicle model{/snippet}
{#snippet vColor()}Vehicle color{/snippet}
{#snippet vFuel()}Fuel type{/snippet}

<!-- Color -->
{#snippet clColor()}Color name{/snippet}
{#snippet clColorHex()}Hex color (e.g. <code>#a1b2c3</code>){/snippet}
{#snippet clBackgroundColor()}Hex color{/snippet}

<!-- System -->
{#snippet sPlatform()}Operating system{/snippet}
{#snippet sBrowser()}Browser name{/snippet}
{#snippet sSemver()}Semver string{/snippet}
{#snippet sFileName()}File name{/snippet}
{#snippet sFilePath()}File path{/snippet}
{#snippet sFileExtension()}File extension{/snippet}
{#snippet sMimeType()}MIME type{/snippet}

<!-- Word & free text -->
{#snippet wWord()}A single noun{/snippet}
{#snippet wText()}Lorem text (respects <code>.min()</code>/<code>.max()</code>){/snippet}

<!-- Numbers -->
{#snippet nAmount()}<em>log-uniform</em> — Currency amount, Benford-conforming
	(<code>.min()</code>/<code>.max()</code>, default 1 – 10 000){/snippet}
{#snippet nPrice()}<em>log-uniform</em> — Price amount, Benford-conforming
	(<code>.min()</code>/<code>.max()</code>, default 1 – 500){/snippet}
{#snippet nBalance()}<em>log-uniform</em> — Money balance (default 1 – 100 000){/snippet}
{#snippet nTotal()}<em>log-uniform</em> — Order total / subtotal (default 1 – 10 000){/snippet}
{#snippet nRevenue()}<em>log-uniform</em> — Revenue figure (default 1 000 – 1 × 10⁹){/snippet}
{#snippet nCost()}<em>log-uniform</em> — Cost / fee amount (default 1 – 1 000){/snippet}
{#snippet nSalary()}<em>log-uniform</em> — Annual salary (default 20 000 – 500 000){/snippet}
{#snippet nFileSize()}<em>log-uniform-int</em> — Scale-free byte count (default 100 – 1 × 10⁹){/snippet}
{#snippet nViews()}<em>log-uniform-int</em> — Scale-free count (default 1 – 1 × 10⁷){/snippet}
{#snippet nDistance()}<em>log-uniform</em> — Continuous distance (default 1 – 10 000){/snippet}
{#snippet nRating()}<em>uniform</em> — Bounded score on <code>[0, 5]</code>{/snippet}
{#snippet nScore()}<em>uniform</em> — Bounded score on <code>[0, 100]</code>{/snippet}
{#snippet nLatitude()}<em>uniform</em> — Latitude in degrees{/snippet}
{#snippet nLongitude()}<em>uniform</em> — Longitude in degrees{/snippet}
{#snippet nPort()}<em>uniform</em> — TCP/UDP port number{/snippet}
{#snippet nQuantity()}<em>geometric</em> — Truncated geometric (<code>p = 0.5</code>), modal at lower
	bound (default <code>[1, 100]</code>){/snippet}
{#snippet nCount()}<em>geometric</em> — Truncated geometric (<code>p = 0.5</code>), modal at lower
	bound; <code>min = 0</code> native (default <code>[0, 50]</code>){/snippet}
{#snippet nAge()}<em>log-normal</em> — Clipped log-normal centred on μ = ln(36), σ = 0.35 (default
	<code>[18, 80]</code>); tight bounds → uniform-int{/snippet}
{#snippet nYear()}<em>exponential</em> — Exponential recent-skew (λ = 0.05); default
	<code>[currentYear - 50, currentYear]</code>; tight → uniform-int{/snippet}

<!-- Pattern (string) -->
{#snippet psUuid()}<strong>Match:</strong> exactly <code>id</code>, or <strong>ends with</strong>
	<code>id</code>, <code>uuid</code>, <code>guid</code>. UUID (RFC 4122 v4){/snippet}
{#snippet psName()}<strong>Match:</strong> <strong>ends with</strong> <code>name</code>. Full name{/snippet}
{#snippet psUrl()}<strong>Match:</strong> <strong>ends with</strong> <code>url</code>,
	<code>link</code>, or <strong>starts with</strong> <code>url</code>. HTTPS URL{/snippet}
{#snippet psEmail()}<strong>Match:</strong> <strong>ends with</strong> <code>email</code>. Realistic
	email{/snippet}
{#snippet psDate()}<strong>Match:</strong> <strong>ends with</strong> <code>at</code>,
	<code>date</code>, <strong>starts with</strong> <code>date</code>, or <strong>ends with</strong>
	<code>_on</code> (excluding <code>position</code>). ISO 8601 date string{/snippet}

<!-- Pattern (date) -->
{#snippet pdDate()}<strong>Match:</strong> <strong>ends with</strong> <code>at</code>,
	<code>date</code>, <strong>starts with</strong> <code>date</code>, or <strong>ends with</strong>
	<code>_on</code> (excluding <code>position</code>). A <code>Date</code> instance{/snippet}

<!-- Pattern (number) -->
{#snippet pnDate()}<strong>Match:</strong> <strong>ends with</strong> <code>at</code>,
	<code>date</code>, <strong>starts with</strong> <code>date</code>, or <strong>ends with</strong>
	<code>_on</code> (excluding <code>position</code>). Unix-ms timestamp{/snippet}

<!-- Dutch strings -->
{#snippet dlVoornaam()}First name{/snippet}
{#snippet dlAchternaam()}Last name{/snippet}
{#snippet dlStraat()}Street name{/snippet}
{#snippet dlStad()}City{/snippet}
{#snippet dlLand()}Country{/snippet}
{#snippet dlKenteken()}License plate (VRM){/snippet}
{#snippet dlVoertuigkleur()}Vehicle color{/snippet}
{#snippet dlKleur()}Color name{/snippet}
{#snippet dlTelefoon()}Phone number{/snippet}
{#snippet dlPrijs()}Price string (respects <code>.min()</code>/<code>.max()</code>){/snippet}
{#snippet dlOmschrijving()}Description (lorem text, length-aware){/snippet}
{#snippet dlBericht()}Message (lorem text, length-aware){/snippet}

<!-- Dutch numbers -->
{#snippet dnBedrag()}Amount (respects <code>.min()</code>/<code>.max()</code>, default 1 – 10 000){/snippet}
{#snippet dnPrijs()}Price (respects <code>.min()</code>/<code>.max()</code>, default 1 – 500){/snippet}

<DocPage title="Key Heuristics" sidebarGroup="reference" order={2}>
	<p>
		The key-based generator fires <strong>after matchers and per-schema <code>withKeyMap</code> /
		world-level <code>withGenerators</code>, and before schema-based generation</strong>. It
		inspects the field name and, when it recognises the pattern, produces a semantically meaningful
		value — no matcher required.
	</p>

	<p>
		This page lists every exact-key entry, every pattern rule, and the Dutch-language aliases that
		ship in <code>src/generators/data/key-map.ts</code>. Use <code>world.explain(schema)</code> to
		inspect what the engine would pick for any given schema.
	</p>

	<hr />

	<h2>How it works</h2>
	<p>The library calls <code>generateFromKey(key, schema, ctx)</code>:</p>
	<ol>
		<li>
			The field name is <strong>lowercased</strong> for matching (case-insensitive —
			<code>CreatedAt</code>, <code>created_at</code>, <code>CREATEDAT</code> all match the same rule).
		</li>
		<li>
			The Zod schema is unwrapped to its <strong>leaf type</strong> (<code>string</code>,
			<code>number</code>, <code>date</code>, …) — <code>getLeafDef(schema)</code> strips
			<code>optional</code>, <code>nullable</code>, <code>default</code>, <code>readonly</code>,
			<code>catch</code>, <code>brand</code>.
		</li>
		<li>
			<code>DEFAULT_KEY_MAP[leafType][lowercasedKey]</code> is consulted first. If an
			<strong>exact-key entry</strong> exists, it wins.
		</li>
		<li>
			Otherwise the rules in <code>DEFAULT_KEY_PATTERNS[leafType]</code> are tried in order; the
			<strong>first matching pattern</strong> wins.
		</li>
		<li>
			If neither table matches, the key-based generator returns <code>undefined</code> and the engine
			falls through to schema-based generation.
		</li>
	</ol>

	<p>
		Many rules are <strong>schema-type-gated</strong>: a key like <code>email</code> only matches when
		the field is <code>z.string()</code>. A field named <code>email: z.number()</code> falls through
		to schema-based generation (no exact-key fire from <code>DEFAULT_KEY_MAP.string</code>).
	</p>

	<p>
		The full resolution order in <code>WorldImpl.generateObjectFields</code> is (the term is the
		identifier shown in <code>world.explain</code> output):
	</p>

	<DefinitionList entries={resolutionEntries} />

	<hr />

	<h2>Exact-key generators (string)</h2>
	<p>
		These fire when the field is a <code>z.string()</code> (or unwrapped to one) and the lowercased
		field name <strong>exactly matches</strong> the key.
	</p>

	<h3>Person</h3>
	<DefinitionList entries={personEntries} />

	<h3>Internet</h3>
	<DefinitionList entries={internetEntries} />

	<h3>Location</h3>
	<DefinitionList entries={locationEntries} />

	<h3>Finance</h3>
	<DefinitionList entries={financeEntries} />

	<h3>Commerce</h3>
	<DefinitionList entries={commerceEntries} />

	<h3>Company</h3>
	<DefinitionList entries={companyEntries} />

	<h3>Phone</h3>
	<DefinitionList entries={phoneEntries} />

	<h3>Vehicle</h3>
	<DefinitionList entries={vehicleEntries} />

	<h3>Color (CSS / UI)</h3>
	<DefinitionList entries={colorEntries} />

	<h3>System</h3>
	<DefinitionList entries={systemEntries} />

	<h3>Word &amp; free text</h3>
	<DefinitionList entries={wordEntries} />

	<hr />

	<h2>Exact-key generators (number)</h2>
	<p>These fire when the field is a <code>z.number()</code> (or unwrapped to one).</p>

	<DefinitionList entries={numberEntries} />

	<hr />

	<h2>Pattern generators</h2>
	<p>
		When an exact-key entry does not match, the engine tries pattern rules. Each rule has a
		<code>test(lowercasedKey)</code> function; the <strong>first match wins</strong>.
	</p>

	<h3>Pattern generators (string)</h3>
	<DefinitionList entries={patternStringEntries} />

	<h3>Pattern generators (date)</h3>
	<p>
		When the field is a <code>z.date()</code> (or coerced/unwrapped to one), the date pattern produces
		a <code>Date</code> object.
	</p>
	<DefinitionList entries={patternDateEntries} />

	<h3>Pattern generators (number)</h3>
	<p>
		When the field is a <code>z.number()</code>, the date pattern produces a Unix timestamp in
		milliseconds.
	</p>
	<DefinitionList entries={patternNumberEntries} />

	<p>
		The same key with a different Zod type yields a different output: <code>createdAt: z.string()</code>
		→ ISO string; <code>createdAt: z.date()</code> → <code>Date</code>; <code>createdAt: z.number()</code>
		→ ms timestamp.
	</p>

	<hr />

	<h2>Localised aliases</h2>
	<p>
		The Dutch-language keys live in <code>DEFAULT_KEY_MAP</code> <strong>itself</strong> — they are
		not provided by the locale packages. The locale packages (<code>@zod4-mock/locale-en</code>,
		<code>@zod4-mock/locale-nl</code>, <code>@zod4-mock/locale-names</code>) supply
		<code>LocaleData</code> (vocabulary, formatters, Markov models), not key maps. Adding a new locale
		does <strong>not</strong> add new key aliases; those changes happen in
		<code>src/generators/data/key-map.ts</code>.
	</p>
	<p>The Dutch aliases that ship today:</p>

	<h3>Strings</h3>
	<DefinitionList entries={dutchStringEntries} />

	<h3>Numbers</h3>
	<DefinitionList entries={dutchNumberEntries} />

	<hr />

	<h2>Using <code>world.explain</code> to debug a schema</h2>
	<p>
		<code>world.explain(schema)</code> reports — for each top-level field — which row of this table
		the engine would pick. It is read-only and PRNG-neutral, so it never disturbs the next
		<code>generate</code> call. See <a href="/docs/api">world.explain in the API Reference</a> for the
		full type.
	</p>

	<p>
		Try the schema below in the playground — every field resolves through the heuristics above
		(<code>firstName</code> → a first name, <code>email</code> → an email, <code>id</code> → a UUID),
		while <code>homeAddress</code> matches no rule and falls through to schema-based generation:
	</p>

	<Playground initialCode={explainCode} />

	<pre><code>{`const UserSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  email: z.string(),
  homeAddress: z.string(), // ← does NOT match any exact key
  kind: z.string(),
});

const world = createWorld({ seed: 1 }).withSchema(UserSchema, {
  matchers: { kind: () => "admin" },
});

console.log(world.explain(UserSchema).toString());
// id          → string.uuid      (key-pattern: ends with "id")
// firstName   → person.firstName (exact key: "firstname")
// email       → internet.email   (exact key: "email")
// homeAddress → schema-based     (no key match, no matcher)
// kind        → matcher:kind     (matcher registered via withSchema)`}</code></pre>

	<p>
		The <code>homeAddress</code> line is the <strong>near-miss diagnostic</strong>: the field name
		didn't match any rule, so a random schema-based string will be produced. Renaming it to
		<code>address</code>, or registering a matcher, attaches a realistic generator.
	</p>

	<hr />

	<h2>Overriding a built-in heuristic</h2>
	<p>
		<strong>Option A — Matcher in <code>withSchema</code></strong> (field-specific, highest priority):
	</p>
	<pre><code>{`world.withSchema(OrderSchema, {
  matchers: {
    email: (ctx) => \`orders+\${ctx.gen.string.uuid()}@mycompany.com\`,
  },
});`}</code></pre>

	<p><strong>Option B — <code>world.withGenerators</code></strong> (world-wide, overrides built-ins):</p>
	<pre><code>{`world.withGenerators({
  email: (_schema, ctx) => \`user\${ctx.prng.int(1, 999)}@internal.example.com\`,
});`}</code></pre>

	<p>
		Custom generators registered via <code>withGenerators</code> or <code>WorldOptions.generators</code>
		take priority over the built-in heuristics. Keys are matched case-insensitively.
	</p>

	<hr />

	<h2>Adding domain-specific generators</h2>
	<pre><code>{`const world = createWorld({
  seed: 42,
  generators: {
    durationS: (_schema, ctx) => ctx.prng.int(30, 3600),
    vendorCode: (_schema, ctx) => \`V-\${ctx.prng.int(1000, 9999)}\`,
  },
});`}</code></pre>

	<p>
		Or additively via <code>world.withGenerators({'{...}'})</code>. See <code>KeyGenerator</code> for
		the signature.
	</p>

	<hr />

	<h2>Important notes</h2>
	<ul>
		<li>
			<strong>Field names are matched after lowercasing.</strong> Original casing is irrelevant.
		</li>
		<li>
			<strong>Date heuristics are type-aware.</strong> A field named <code>createdAt</code> produces a
			<code>Date</code>, an ISO string, or a numeric timestamp depending on the Zod schema.
		</li>
		<li>
			<strong>Other heuristics are schema-type-gated.</strong> <code>quantity</code>, <code>count</code>,
			etc. only fire for <code>z.number()</code>; a <code>z.string()</code> field named
			<code>quantity</code> falls through to schema-based generation.
		</li>
		<li>
			<strong>Custom generators take priority.</strong> Anything registered via
			<code>WorldOptions.generators</code> or <code>world.withGenerators(...)</code> overrides the
			built-in table.
		</li>
		<li>
			<strong><code>inline:&lt;key&gt;</code> identifiers</strong> indicate a length-aware or composite
			inline closure in <code>DEFAULT_KEY_MAP</code> (e.g. <code>bio</code>, <code>description</code>,
			<code>sku</code>, <code>accountnumber</code>). The behaviour is documented in the description
			column.
		</li>
	</ul>
</DocPage>
