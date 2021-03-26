<?xml version="1.0" encoding="ISO-8859-1"?>
<xsl:stylesheet xmlns="http://www.w3.org/1999/xhtml" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:sp="http://www.spase-group.org/data/schema" xmlns:vot="http://www.ivoa.net/xml/VOTable/VOTable/v1.1" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"  version="1.0" exclude-result-prefixes="sp vot">
  <xsl:param name="spase.resolver" select="'http://spase-group.org/registry/resolver'"/>
  <xsl:param name="spase.render" select="'http://spase-group.org/registry/render'"/>
  <!--
  <xsl:output doctype-system="http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd" doctype-public="-//W3C//DTD XHTML 1.1//EN" method="xhtml" indent="yes" omit-xml-declaration="yes"/>
  -->
  <xsl:strip-space elements="*"/>
  
  <xsl:template match="/">
   <html>
   <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <title>SPASE Resource Description</title>
	  <!-- Data discovery metadata -->
      <script type="application/ld+json">{
		"@context": "https://schema.org/",
		"@type" :"Dataset",
		"name": "<xsl:value-of select="./sp:Spase/*/sp:ResourceHeader/sp:ResourceName" />",
     <xsl:if test="./sp:Spase/*/sp:ResourceHeader/sp:DOI">
		"doi": "<xsl:value-of select="./sp:Spase/*/sp:ResourceHeader/sp:DOI" />",
		"publication": "<xsl:value-of select="./sp:Spase/*/sp:ResourceHeader/sp:PublicationInfo/sp:Authors" />, <xsl:value-of select="./sp:Spase/*/sp:ResourceHeader/sp:ResourceName" />", <xsl:value-of select="./sp:Spase/*/sp:ResourceHeader/sp:PublishedBy" /> (<xsl:value-of select="substring(./sp:Spase/*/sp:ResourceHeader/sp:PublicationInfo/sp:PublicationDate, 1, 4)" />)",
		"publisher  ":{
		   "@type": "Organization",
           "name": "<xsl:value-of select="./sp:Spase/*/sp:ResourceHeader/sp:PublicationInfo/sp:PublishedBy" />"
		},
	</xsl:if>
 		"description": "<xsl:call-template name="normalize-json"><xsl:with-param name="replace" select="'&#10;'" /><xsl:with-param name="with" select="'\n'" /><xsl:with-param name="text" select="./sp:Spase/*/sp:ResourceHeader/sp:Description"/></xsl:call-template>",
		"abstract": "<xsl:call-template name="normalize-json"><xsl:with-param name="replace" select="'&#10;'" /><xsl:with-param name="with" select="'\n'" /><xsl:with-param name="text" select="./sp:Spase/*/sp:ResourceHeader/sp:Description"/></xsl:call-template>",
		"temporalCoverage": "1990.10.06  2009.30.06",
		"keywords": [ <xsl:for-each select="./sp:Spase/*/sp:Keyword"> "<xsl:value-of select="." />"<xsl:if test="position() != last()"><xsl:text>,</xsl:text></xsl:if></xsl:for-each> ],
		"license": "https://cdla.io/permissive-1-0/",
        "audience":{
            "@type": "Audience",
            "audienceType": ["Space Physicist", "Space Community", "Data Scientists", "Machine Learning Users"]
        }
	  }
	  </script>
	  <!-- CSS -->
	  <style>
/* http://spase-group.org/tools/xmlviewer */
/* v1.0 | 20160908 */

* {
   margin: 0;
   padding: 0;
   border: 0;
   outline: 0;
   font-size: 100%;
   vertical-align: baseline;
   background: transparent;
}

body {
	background-color: #f0f0f0; // #eaf5e9; #277bc0; #d3d3f9;
	color: black;
	font-family: Verdana, Arial, sans-serif; 
	font-size:12px; 
	line-height: 1.2;
}
 
h1,h2,h3,h4,h5,h6 {
	margin-top: 10px;
	margin-bottom: 10px;
	font-weight:bold;
}

h1 {
	font-size: 140%;
}

h2 {
	font-size: 120%;
}

h3 {
	font-size: 110%;
	font-style: oblique;
}

p {
	margin-bottom: 0.75ex;
}

a:link,
a:visited {
   color: #277bc0;/* #339;*/
   font-weight:bolder; 
   text-decoration:none; 
}

a:hover {
   color: blue;
   font-weight:bolder; 
   text-decoration:underline; 
}

ul {
	list-style: square inside ;
	margin-bottom: 0.75ex;
}

table {
   border: thin solid #666;
	margin-top: 5px;
	margin-bottom: 10px;
}

table.nested {
	margin-left: 2em;
}

thead,tbody {
   border: thin solid #666;
}

td, th {
   margin: 0;
	padding: 2px 2px 2px 2px;
}

th {
	font-style: oblique;
}

h1.detail {
}

.header {
	width:100%;
	padding: 1em 10px 1em 10px;
	color: #fff;
	background: #5e87b0;
	font-weight: bold;
	text-shadow: 0 /*{b-bar-shadow-x}*/ 1px /*{b-bar-shadow-y}*/ 1px /*{b-bar-shadow-radius}*/ #3e6790 /*{b-bar-shadow-color}*/;
	text-align: center;
	font-size: 16px;
	display: block;
	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
	outline: 0 !important;
}

.inset {
	margin-left: 22%;
}

.page {
	padding: 10px 3% 10px 3%;
}

div.indent {
    margin-left: 2em;
}

div.term {
	margin-top: 5px;
	padding-left: 5px;
	border-top: 1px solid #DDD;
	font-weight: bold;
}

div.definition {
	margin-left: 5ex;
}

div.value {
	margin-left: 5ex;
}

div.product {
	background-color: white;
	border: thin solid #333;
	padding: 10px 15px 10px 15px;
	margin-top: 10px;
}

div.parameter {
	margin-top: 10px;
	padding: 5px 10px 10px 10px;
	border: thin dotted #333;
	background-color: #ebebeb;
}

#toc {
   border: thin solid #333;
   background-color: #F5F5F5; 
   padding: 10px 15px 10px 15px;
   margin-left: 5%;
   margin-right: 5%;
   margin-bottom: 30px;
}

#toc ol, ul, li {
	padding-left: 5ex;
}

#toc ol {
	list-style-type: decimal;
	list-style-position: inside; 
}

#toc ul {
	list-style-type: square;
	list-style-position: inside; 
}

p.version {
  float: right;
  width: 100%;
  margin-top: 5px;
  text-align: right;
  font-size: x-small;
}

p.right {
  float: right;
  text-align: right;
}

.box-title {
	font-size: 120%;
	font-weight:bold;
	text-align: center;
	border-bottom: 1px solid #DDD;
}

ul.list {
	list-style-position: outside;
	padding-left: 1.5em;
}

li.list {
	text-align: left;
	padding-left: 0px;
}

.no-break {
	white-space: nowrap;
}

p.author {
	font-size: 120%;
}

div.brand {
	width: 100%;
	text-align: right;
}

div.abstract {
	display: table;
	position: relative;
	width: 100%;
}

div.citation {
}

div.access {
	float: left;
	width: 20%;
	background-color: white;
	border: thin solid #333;
	padding: 5px 5px 5px 5px;
	margin-right: 1em;
}

a.xml-logo:link,
a.xml-logo:visited {
   background: #ff6600;
   color: #ffffff;
   font-weight:bolder; 
   text-decoration:none; 
   padding-left:2px;
   padding-right:2px;
}
a.xml-logo:hover {
   text-decoration:underline; 
}

	  </style>
	</head>
	<body>
		<div><a id="top"></a></div>
		<div class="header">
			<div class="middle">HPDE.io</div>
		</div> <!-- /header -->
		<div class="page">
       <xsl:apply-templates select="Package"/>	<!-- create table of content if present -->
       <xsl:apply-templates select="./*/sp:Spase"/> <!-- Process each description in a Package -->
       <xsl:apply-templates select="sp:Spase"/> <!-- Process a single description -->
	   </div>
   </body>
   </html>
</xsl:template>

<xsl:template match="Package">
    <div id="toc">
      <h2>Table of Contents</h2>
      <ol>
		<xsl:for-each select="./sp:Spase">
			<li><a href="#{./*/sp:ResourceID}"><xsl:value-of select="./*/sp:ResourceID" /></a></li>
		</xsl:for-each>
	  </ol>
	</div>
</xsl:template>
	  
<xsl:template match="sp:Spase">
	<div class="spase">
		<div class="abstract">
		<xsl:variable name="inset">
		   <xsl:if test="./*/sp:AccessInformation">inset</xsl:if>
		</xsl:variable>
		<xsl:if test="./*/sp:AccessInformation">
			<div class="access">
				<p class="box-title">Data Access</p>
				<ul class="list">
				<xsl:for-each select="./*/sp:AccessInformation">
					<xsl:for-each select="./sp:AccessURL">
						<li class="list"><a target="_blank" href="{./sp:URL}"><xsl:if test="./sp:Style"><xsl:value-of select="./sp:Style" />: </xsl:if><xsl:value-of select="./sp:Name" /></a></li>
					</xsl:for-each>
				</xsl:for-each>
				</ul>
			</div>
		</xsl:if>
		<div class="citation {$inset}">
			<h1><a name="{./*/sp:ResourceID}"><xsl:value-of select="./*/sp:ResourceHeader/sp:ResourceName" /></a></h1>
			<xsl:if test="./*/sp:ResourceHeader/sp:PublicationInfo">
			<p class="author"><script>var authors='<xsl:value-of select="./*/sp:ResourceHeader/sp:PublicationInfo/sp:Authors" />'; var namefixed = authors.replace(/, (.)[^,; ]*/g, ", $1."); var almost = namefixed.replace(/;([^;]*)$/, ' and $1'); document.write(almost.replace(/;[ ]*/g, ", "));</script>
			(<xsl:value-of select="substring(./*/sp:ResourceHeader/sp:PublicationInfo/sp:PublicationDate, 1, 4)" />). 
			<xsl:value-of select="./*/sp:ResourceHeader/sp:ResourceName" />
			<xsl:call-template name="ref-type">
				<xsl:with-param name="input" select="./*/sp:ResourceID"/>
			</xsl:call-template>
			<xsl:value-of select="./*/sp:ResourceHeader/sp:PublicationInfo/sp:PublishedBy" />. 
			<xsl:if test="./*/sp:ResourceHeader/sp:DOI"><a href="{./*/sp:ResourceHeader/sp:DOI}"><xsl:value-of select="./*/sp:ResourceHeader/sp:DOI" /></a>.</xsl:if>
			Accessed on <script>var monthName=new Array("January","February","March","April","May","June","July","August","September","October","November","December"); var today = new Date(); document.write(today.getFullYear()+'-'+monthName[today.getMonth()]+'-'+today.getDate()); </script>.
			</p>
			</xsl:if>
			<p><div class="term">ResourceID</div><div class="definition"><xsl:value-of select="./*/sp:ResourceID" /></div></p>
			<p><xsl:apply-templates select="./*/sp:ResourceHeader/sp:Description"></xsl:apply-templates></p>
		
		</div>
		</div>
		
		<div>	<!-- formats -->
			<p class="right">
				<xsl:if test="name(..) = 'Package'"><a href="#top">top</a> | </xsl:if>
				<xsl:variable name="fileName">
					<xsl:call-template name="getFileName">
						<xsl:with-param name="path" select="./*/sp:ResourceID" />
					</xsl:call-template>  
				</xsl:variable>	
				<xsl:variable name="resourceURL">
					<xsl:call-template name="string-replace-all">
						<xsl:with-param name="replace" select="'spase://'" />
						<xsl:with-param name="with" select="'https://hpde.io/'" />
						<xsl:with-param name="text" select="./*/sp:ResourceID"/>
					</xsl:call-template>  
				</xsl:variable>	
				
				<a target="_blank" href="{$fileName}.xml">View XML</a> 
				| <a target="_blank" href="{$fileName}.json">View JSON</a> 
				| <a target="_blank" href="http://xmleditor.spase-group.org/?edit={$resourceURL}.xml">Edit</a>
			</p>
			<h1 class="detail">Details</h1>
		</div>
	
	<div> <!-- Full description -->
	<xsl:for-each select="*">
	   <xsl:choose>
			<xsl:when test="local-name() = 'Version'"> <!-- We skip this -->
			</xsl:when>
			<xsl:otherwise> <!-- All others -->
				<div class="product">
					<p class="version">Version:<xsl:value-of select="../sp:Version"/></p>
					<h1><xsl:value-of select="local-name()"/></h1>
					<xsl:apply-templates select="*"></xsl:apply-templates>
				</div>
			</xsl:otherwise>
	   </xsl:choose>			
    </xsl:for-each>
	</div>
	</div> <!-- spase -->
</xsl:template>

<xsl:template match="*">
	   <xsl:choose>
		<xsl:when test="*"> <!-- has children -->
		   <xsl:choose>
				<xsl:when test="local-name() = 'Parameter'"> <!-- Add count to tabel -->
					<div class="parameter"><xsl:value-of select="local-name()"/> #<xsl:value-of select="1 + count(preceding-sibling::*[name() = name(current())])" /></div>
				</xsl:when>
				<xsl:otherwise>	<!-- Show name/value -->
					<div class="term"><xsl:value-of select="local-name()"/></div>
				</xsl:otherwise>
			</xsl:choose>
			<div class="definition">
				<xsl:apply-templates select="*"></xsl:apply-templates>
			</div>
		</xsl:when>
		<xsl:otherwise>
		   <xsl:choose>
				<xsl:when test="'ID' = substring(local-name(), string-length(local-name()) - 1)"> <!-- Fix-up ID: Length of string is 1 more than than position count -->
				<!-- <xsl:when test="ends-with(local-name(), 'ID')"> --> <!-- set anchor -->
					<div class="term"><xsl:value-of select="local-name()"/></div><div class="definition"><a href="https://hpde.io/{substring-after(., 'spase://')}.html"><xsl:value-of select="."/></a></div> 
				</xsl:when>
				<xsl:when test="'Date' = substring(local-name(), string-length(local-name()) - 3)"> <!-- Fix-up date:  Length of string is 1 more than than position count -->
				<!--- <xsl:when test="ends-with(local-name(), 'Date')"> --> <!-- Fix-up date -->
					<div class="term"><xsl:value-of select="local-name()"/></div><div class="definition"><xsl:value-of select="translate(., 'T', ' ')"/></div>
				</xsl:when>
				<xsl:when test="local-name() = 'URL'"> <!-- Format link -->
					<div class="term"><xsl:value-of select="local-name()"/></div><div class="definition"><a target="_blank" href="{.}"><xsl:value-of select="."/></a></div>
				</xsl:when>
				<xsl:otherwise>	<!-- Show name/value -->
					<xsl:if test="not(. = '')"> <!-- only if there is content -->
						<div class="term"><xsl:value-of select="local-name()"/></div><div class="definition"><xsl:value-of select="."/></div>
					</xsl:if>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:otherwise>
	   </xsl:choose>
 
</xsl:template>

<xsl:template match="sp:Contact">
	<xsl:if test="count(preceding-sibling::*[name() = name(current())]) = 0">
		<!-- Initialize table -->
		<div class="term"><xsl:value-of select="local-name()"/>s</div>
		<xsl:text disable-output-escaping="yes">&lt;dd&gt;</xsl:text>
		<xsl:text disable-output-escaping="yes">&lt;table class="nested" cellspacing="0"&gt;</xsl:text>
		<tr><th></th><th class="center">Role</th><th class="center">Person</th></tr>
		<xsl:text disable-output-escaping="yes">&lt;tbody&gt;</xsl:text>
	</xsl:if>
	<tr><td><xsl:value-of select="1 + count(preceding-sibling::*[name() = name(current())])" />.</td><td><xsl:value-of select="sp:Role"/></td><td><a target="_blank" href="https://hpde.io/{substring-after(sp:PersonID, 'spase://')}.html"><xsl:value-of select="sp:PersonID"/></a></td></tr>
	<xsl:if test="count(following-sibling::*[name() = name(current())]) = 0">
		<!-- Finalize table -->
		<xsl:text disable-output-escaping="yes">&lt;/tbody&gt;</xsl:text>
		<xsl:text disable-output-escaping="yes">&lt;/table&gt;</xsl:text>
		<xsl:text disable-output-escaping="yes">&lt;/dd&gt;</xsl:text>
	</xsl:if>
</xsl:template>

<!-- 
Wrap text in {{#markdown}}{{/markdown}} for processing with Handlebars.
Also remove leading and trailing spaces to get desired formatting.
-->
<xsl:template match="sp:Description">
	<div class="term"><xsl:value-of select="local-name()"/></div><div class="definition">{{#markdown}}<xsl:call-template name="trim"><xsl:with-param name="input" select="."/></xsl:call-template>{{/markdown}}</div>
</xsl:template>

<xsl:template match="sp:Keyword">
	<xsl:if test="count(preceding-sibling::*[name() = name(current())]) = 0">
		<div class="term"><xsl:value-of select="local-name()"/>s</div>
	</xsl:if>
	<xsl:if test="not(. = '')"> <!-- only if there is content -->
		<div class="definition"><xsl:value-of select="."/></div>
	</xsl:if>
</xsl:template>

<xsl:template match="sp:ResourceID">
	<div class="term"><xsl:value-of select="local-name()"/></div><div class="definition"><xsl:value-of select="."/></div>
</xsl:template>

<xsl:template match="sp:InstrumentID">
	<xsl:if test="count(preceding-sibling::*[name() = name(current())]) = 0">
		<div class="term"><xsl:value-of select="local-name()"/>s</div>
	</xsl:if>
	<div class="definition"><a target="_blank" href="https://hpde.io/{substring-after(., 'spase://')}.html"><xsl:value-of select="."/></a></div>
</xsl:template>

<xsl:template match="sp:PriorID">
	<xsl:if test="count(preceding-sibling::*[name() = name(current())]) = 0">
		<div class="term"><xsl:value-of select="local-name()"/>s</div>
	</xsl:if>
	<div class="definition"><xsl:value-of select="."/></div>
</xsl:template>

<!-- Get the fileName portion of a path. 
Call with the following:
	<xsl:call-template name="fileName">
		<xsl:with-param name="path" select="YourValue" />
	</xsl:call-template>  
-->
<xsl:template name="getFileName">
  <xsl:param name="path" />
  <xsl:choose>
    <xsl:when test="normalize-space(substring-after($path,'/'))">
      <xsl:call-template name="getFileName">
        <xsl:with-param name="path" select="substring-after($path,'/')" />
      </xsl:call-template>  
    </xsl:when>
    <xsl:otherwise>
      <xsl:value-of select="$path" />
    </xsl:otherwise>
  </xsl:choose>
</xsl:template>

<!-- Trim leading and trailing space from a string -->
<xsl:template name="trim">
	<xsl:param name="input"/>
	<xsl:choose>
		<xsl:when test="starts-with($input,' ')">
			<xsl:call-template name="trim">
				<xsl:with-param name="input" select="substring-after($input,' ')"/>
			</xsl:call-template>
		</xsl:when>
		<xsl:when test="starts-with($input,'&#10;')"> <!-- newline -->
			<xsl:call-template name="trim">
				<xsl:with-param name="input" select="substring-after($input,' ')"/>
			</xsl:call-template>
		</xsl:when>
		<xsl:when test="starts-with($input,'&#13;')"> <!-- carriage return -->
			<xsl:call-template name="trim">
				<xsl:with-param name="input" select="substring-after($input,' ')"/>
			</xsl:call-template>
		</xsl:when>
		<xsl:when test="substring($input, string-length($input) ) = ' ' ">
			<xsl:call-template name="trim">
				<xsl:with-param name="input" select="substring($input, 1, string-length($input)-1)"/>
			</xsl:call-template>
		</xsl:when>
		<xsl:otherwise>
			<xsl:value-of select="$input"/>
		</xsl:otherwise>
	</xsl:choose>
</xsl:template>

<!-- Replace a string every where it occurs -->
<xsl:template name="normalize-json">
    <xsl:param name="text" />
	<xsl:variable name="value">
		<xsl:call-template name="string-replace-all">
			<xsl:with-param name="replace" select="'&#10;'" />
			<xsl:with-param name="with" select="'\n'" />
			<xsl:with-param name="text" select="$text"/>
		</xsl:call-template>
	</xsl:variable>	
	<xsl:call-template name="string-replace-all">	
		<xsl:with-param name="text" select="$value" />
		<xsl:with-param name="replace" select="'&#34;'" />
		<xsl:with-param name="with" select="'\&#34;'" />
	</xsl:call-template>
</xsl:template>

<!-- Replace a string every where it occurs -->
<xsl:template name="ref-type">
    <xsl:param name="input" />
	<xsl:choose>
		<xsl:when test="contains($input, 'NumericalData')">
			[Data set].
		</xsl:when>
		<xsl:when test="contains($input, 'DisplayData')">
			[Data set].
		</xsl:when>
		<xsl:when test="contains($input, 'Catalog')">
			[Data set].
		</xsl:when>
		<xsl:otherwise>
			.
		</xsl:otherwise>
	</xsl:choose>
</xsl:template>

<!-- Replace a string every where it occurs -->
<xsl:template name="string-replace-all">
    <xsl:param name="text" />
    <xsl:param name="replace" />
    <xsl:param name="with" />
    <xsl:choose>
      <xsl:when test="contains($text, $replace)">
        <xsl:value-of select="substring-before($text,$replace)" />
        <xsl:value-of select="$with" />
        <xsl:call-template name="string-replace-all">
          <xsl:with-param name="text"
          select="substring-after($text,$replace)" />
          <xsl:with-param name="replace" select="$replace" />
          <xsl:with-param name="with" select="$with" />
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$text" />
      </xsl:otherwise>
    </xsl:choose>
</xsl:template>

</xsl:stylesheet>
