
$(document).ready(function(){


var modal1 = document.getElementById('myModal1');
var modal2 = document.getElementById('myModal2');
var modal3 = document.getElementById('myModal3');
// Get the button that opens the modal
var btn1 = document.getElementById("myBtn1");
var btn2 = document.getElementById("myBtn2");
var btn3 = document.getElementById("myBtn3");
var btn4 = document.getElementById("myBtn4");

// Get the <span> element that closes the modal
var span1 = document.getElementById("close1");
var span2 = document.getElementById("close2");
var span3 = document.getElementById("close3");
// When the user clicks the button, open the modal

btn1.onclick = function() {
    modal1.style.display = "block";

    var $main       = $('#main_container');
    var username    = $main.data('username');
    var primus      = new Primus();

    primus.on('data', function (msg) {
        if (!msg || !msg.action)    return;

        switch (msg.action) {
            case 'paired':
                if (!msg.data || !msg.data.gameUrl)  break;
                window.location.href = msg.data.gameUrl;
                break;
        }
    });

    primus.write({
        action: 'lobby',
        data: {
            username: username
        }
    });
}
btn2.onclick = function(e) {
    $.ajax({
        type: 'post',
        dataType: 'json',
        url: '/game/create'
    })
    .then(function (result) {
        if (result.error_code != 0)  {
            console.log('Error: code ' + result.error_code + ', msg: ' + result.msg);
            return;
        }

        var gameId = result.data && result.data.gameId;
        window.location.href = '/game/' + gameId;
    });

    e.preventDefault();
    return false;
}
btn3.onclick = function() {
   modal3.style.display = "block";
}

btn4.onclick = function () {
    var level = $('#ai_level').val();
    window.location.href = '/game/local/' + level;
};

// When the user clicks on <span> (x), close the modal
span1.onclick = function() {
    modal1.style.display = "none";

}
span2.onclick = function() {
    modal2.style.display = "none";

}
span3.onclick = function() {
    modal3.style.display = "none";

}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    if (event.target == modal1) {
        modal1.style.display = "none";
    }

    if (event.target == modal2) {
        modal2.style.display = "none";
    }
    if (event.target == modal3) {
        modal3.style.display = "none";
    }
}


});
